"""
Scrape all pages of PA jurisdiction data by paginating through the SSRS report.
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
from io import StringIO
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
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
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

def scrape_all_pages():
    """Scrape all pages by clicking through pagination"""
    url = "https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel"
    
    driver = setup_driver()
    if not driver:
        return None
    
    all_data = []
    
    try:
        logger.info(f"Navigating to: {url}")
        driver.get(url)
        
        wait = WebDriverWait(driver, 30)
        
        # Select "All Counties"
        logger.info("Selecting 'All Counties'...")
        county_dropdown = wait.until(EC.presence_of_element_located((By.ID, "ctl00_ContentPlaceHolder1_ddlCounty")))
        select_county = Select(county_dropdown)
        select_county.select_by_index(0)  # First option is "All Counties"
        time.sleep(2)
        
        # Click View Report
        logger.info("Clicking View Report...")
        view_button = driver.find_element(By.ID, "ctl00_ContentPlaceHolder1_btnViewReport")
        view_button.click()
        
        # Wait for report
        logger.info("Waiting for report to load...")
        time.sleep(20)
        
        # Try to get Excel export first (best option - gets all data at once)
        logger.info("Attempting Excel export (gets all pages at once)...")
        try:
            # Look for export menu
            export_links = driver.find_elements(By.XPATH, "//a[contains(@title, 'Export') or contains(@id, 'Export')]")
            if export_links:
                export_links[0].click()
                time.sleep(2)
                
                # Look for Excel
                excel_links = driver.find_elements(By.XPATH, "//a[contains(text(), 'Excel') or contains(@title, 'Excel')]")
                if excel_links:
                    excel_links[0].click()
                    logger.info("Clicked Excel export, waiting for download...")
                    time.sleep(30)
                    
                    # Check downloads
                    download_dir = os.path.join(os.getcwd(), 'downloads')
                    if os.path.exists(download_dir):
                        files = os.listdir(download_dir)
                        xlsx_files = [f for f in files if f.endswith('.xlsx') and not f.startswith('~')]
                        downloading = [f for f in files if f.endswith('.crdownload')]
                        
                        if not downloading and xlsx_files:
                            latest = max([os.path.join(download_dir, f) for f in xlsx_files], key=os.path.getctime)
                            logger.info(f"Successfully downloaded: {latest}")
                            return latest
        except Exception as e:
            logger.warning(f"Excel export failed: {e}")
            logger.info("Falling back to pagination method...")
        
        # Fallback: Paginate through pages
        logger.info("Extracting data page by page...")
        page_num = 1
        max_pages = 100  # Safety limit
        
        while page_num <= max_pages:
            logger.info(f"Extracting page {page_num}...")
            
            # Wait for table to load
            time.sleep(5)
            
            # Get page HTML
            html = driver.page_source
            
            # Parse tables
            try:
                tables = pd.read_html(StringIO(html))
                # Find data table (table 11 from previous experience)
                if len(tables) > 11:
                    data_table = tables[11]
                    if len(data_table) > 2:
                        # Extract data (headers in row 1, data starts row 2)
                        headers = data_table.iloc[1].tolist()
                        page_data = data_table.iloc[2:].copy()
                        page_data.columns = [str(h).strip().upper().replace(' ', '_') if pd.notna(h) else f'col_{i}' 
                                            for i, h in enumerate(headers)]
                        page_data = page_data.dropna(how='all')
                        
                        if len(page_data) > 0:
                            all_data.append(page_data)
                            logger.info(f"  Extracted {len(page_data)} rows from page {page_num}")
                        else:
                            logger.info(f"  No data on page {page_num}")
                    else:
                        logger.info(f"  Table too small on page {page_num}")
            except Exception as e:
                logger.warning(f"Error parsing page {page_num}: {e}")
            
            # Try to go to next page
            try:
                # Look for "Next" button
                next_buttons = driver.find_elements(By.XPATH, "//a[contains(text(), 'Next') or contains(@title, 'Next')]")
                if next_buttons:
                    # Check if disabled
                    if 'disabled' not in next_buttons[0].get_attribute('class') or '':
                        next_buttons[0].click()
                        time.sleep(5)
                        page_num += 1
                    else:
                        logger.info("Reached last page")
                        break
                else:
                    logger.info("No next button found, assuming last page")
                    break
            except Exception as e:
                logger.warning(f"Error navigating to next page: {e}")
                break
        
        # Combine all pages
        if all_data:
            logger.info(f"Combining {len(all_data)} pages...")
            combined_df = pd.concat(all_data, ignore_index=True)
            combined_df = combined_df.drop_duplicates()
            
            output_file = os.path.join(os.getcwd(), 'downloads', 'pa_jurisdictions_all_pages.xlsx')
            combined_df.to_excel(output_file, index=False)
            logger.info(f"Saved {len(combined_df)} total rows to: {output_file}")
            return output_file
        else:
            logger.error("No data extracted")
            return None
            
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        logger.info("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    result = scrape_all_pages()
    if result:
        print(f"\nSuccess! Data saved to: {result}")
        print(f"Next: python import_pa_counties_jurisdictions.py {result}")
    else:
        print("\nFailed to extract data")

