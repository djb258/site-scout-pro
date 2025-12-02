"""
Get full PA jurisdiction data by triggering Excel export from SSRS report.
This script opens the browser, navigates to the report, and waits for you to manually
click the Excel export button, then processes the downloaded file.
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_driver():
    """Setup Chrome driver"""
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    # Set download directory
    download_dir = os.path.abspath(os.path.join(os.getcwd(), 'downloads'))
    os.makedirs(download_dir, exist_ok=True)
    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True
    }
    chrome_options.add_experimental_option("prefs", prefs)
    
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.maximize_window()
        return driver
    except:
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.maximize_window()
            return driver
        except Exception as e:
            logger.error(f"Failed to setup driver: {e}")
            return None

def main():
    """Open browser and wait for manual Excel export"""
    url = "https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel"
    
    driver = setup_driver()
    if not driver:
        print("Failed to start browser. Make sure Chrome is installed.")
        return
    
    try:
        logger.info(f"Opening: {url}")
        driver.get(url)
        
        wait = WebDriverWait(driver, 30)
        
        # Select "All Counties"
        logger.info("Selecting 'All Counties'...")
        try:
            county_dropdown = wait.until(EC.presence_of_element_located((By.ID, "ctl00_ContentPlaceHolder1_ddlCounty")))
            select_county = Select(county_dropdown)
            select_county.select_by_index(0)  # First option
            time.sleep(2)
        except:
            logger.warning("Could not find county dropdown, continuing...")
        
        # Click View Report
        logger.info("Clicking 'View Report'...")
        try:
            view_button = driver.find_element(By.ID, "ctl00_ContentPlaceHolder1_btnViewReport")
            view_button.click()
        except:
            logger.warning("Could not find View Report button, continuing...")
        
        logger.info("\n" + "="*80)
        logger.info("WAITING FOR REPORT TO LOAD...")
        logger.info("="*80)
        logger.info("Once the report loads:")
        logger.info("1. Look for 'Export' or 'Excel' button in the report toolbar")
        logger.info("2. Click it to download the Excel file")
        logger.info("3. Wait for download to complete")
        logger.info("4. The script will automatically detect the file")
        logger.info("\nWaiting up to 5 minutes for Excel export...")
        logger.info("="*80)
        
        # Wait for report to load
        time.sleep(30)
        
        # Monitor downloads folder
        download_dir = os.path.join(os.getcwd(), 'downloads')
        initial_files = set()
        if os.path.exists(download_dir):
            initial_files = set(os.listdir(download_dir))
        
        # Wait for new Excel file
        max_wait = 300  # 5 minutes
        waited = 0
        check_interval = 5
        
        while waited < max_wait:
            if os.path.exists(download_dir):
                current_files = set(os.listdir(download_dir))
                new_files = current_files - initial_files
                
                # Look for Excel files
                xlsx_files = [f for f in new_files if f.endswith('.xlsx') and not f.startswith('~')]
                downloading = [f for f in current_files if f.endswith('.crdownload')]
                
                if xlsx_files and not downloading:
                    latest_file = max([os.path.join(download_dir, f) for f in xlsx_files], 
                                    key=lambda f: os.path.getctime(os.path.join(download_dir, f)))
                    logger.info(f"\nSUCCESS! Found Excel file: {latest_file}")
                    logger.info(f"\nNext step: python import_pa_counties_jurisdictions.py {latest_file}")
                    return latest_file
            
            time.sleep(check_interval)
            waited += check_interval
            
            if waited % 30 == 0:
                logger.info(f"Still waiting... ({waited}s elapsed)")
        
        logger.warning("\nTimeout waiting for Excel export")
        logger.info("The browser will stay open. Please:")
        logger.info("1. Manually click Excel export in the report")
        logger.info("2. Wait for download")
        logger.info("3. Close this script and run: python import_pa_counties_jurisdictions.py downloads/[filename].xlsx")
        
        # Keep browser open for manual interaction
        input("\nPress Enter after you've downloaded the Excel file to close the browser...")
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    result = main()
    if result:
        print(f"\nFile ready: {result}")

