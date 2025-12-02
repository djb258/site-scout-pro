"""
Automated scraper for PA DCED Municipal Statistics using Selenium.
This handles the SSRS report viewer that requires form interaction.
"""

import time
import logging
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import os
import pandas as pd
from io import StringIO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_driver(headless=False):
    """Setup Chrome driver with options"""
    chrome_options = Options()
    if headless:
        chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    # Set download directory
    download_dir = os.path.join(os.getcwd(), 'downloads')
    os.makedirs(download_dir, exist_ok=True)
    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True
    }
    chrome_options.add_experimental_option("prefs", prefs)
    
    try:
        # Use webdriver-manager to automatically handle ChromeDriver
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        driver.maximize_window()  # SSRS reports work better in full window
        return driver
    except Exception as e:
        logger.error(f"Error setting up Chrome driver: {e}")
        logger.info("Trying without webdriver-manager...")
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            driver.maximize_window()
            return driver
        except Exception as e2:
            logger.error(f"Failed to setup driver: {e2}")
            return None


def scrape_pa_jurisdictions_selenium(all_counties=True, headless=False):
    """
    Scrape PA jurisdiction data using Selenium.
    
    Args:
        all_counties: If True, select "All Counties", else select specific county
        headless: Run browser in headless mode
    """
    url = "https://apps.dced.pa.gov/Munstats-public/ReportInformation2.aspx?report=CountyMuniBuilding_Excel"
    
    driver = setup_driver(headless=headless)
    if not driver:
        return None
    
    try:
        logger.info(f"Navigating to: {url}")
        driver.get(url)
        
        # Wait for page to load
        wait = WebDriverWait(driver, 30)
        
        # Wait for county dropdown
        logger.info("Waiting for county dropdown...")
        try:
            county_dropdown = wait.until(
                EC.presence_of_element_located((By.ID, "ctl00_ContentPlaceHolder1_ddlCounty"))
            )
        except TimeoutException:
            # Try alternative selectors
            county_selectors = [
                (By.ID, "ddlCounty"),
                (By.NAME, "ctl00$ContentPlaceHolder1$ddlCounty"),
                (By.CSS_SELECTOR, "select[name*='County']"),
                (By.XPATH, "//select[contains(@name, 'County')]")
            ]
            
            county_dropdown = None
            for selector_type, selector_value in county_selectors:
                try:
                    county_dropdown = driver.find_element(selector_type, selector_value)
                    break
                except NoSuchElementException:
                    continue
            
            if not county_dropdown:
                logger.error("Could not find county dropdown")
                return None
        
        # Select county
        select_county = Select(county_dropdown)
        
        if all_counties:
            logger.info("Selecting 'All Counties'...")
            try:
                select_county.select_by_visible_text("- All Counties -")
            except:
                select_county.select_by_index(0)  # First option is usually "All"
        else:
            logger.info("Selecting specific county...")
            # Could select specific county here if needed
            select_county.select_by_visible_text("- All Counties -")
        
        time.sleep(2)  # Wait for page to update
        
        # Find and click View Report button
        logger.info("Looking for View Report button...")
        view_button_selectors = [
            (By.ID, "ctl00_ContentPlaceHolder1_btnViewReport"),
            (By.NAME, "ctl00$ContentPlaceHolder1$btnViewReport"),
            (By.CSS_SELECTOR, "input[type='submit'][value*='View']"),
            (By.XPATH, "//input[@type='submit' and contains(@value, 'View')]"),
            (By.XPATH, "//input[@type='submit' and contains(@value, 'Report')]")
        ]
        
        view_button = None
        for selector_type, selector_value in view_button_selectors:
            try:
                view_button = driver.find_element(selector_type, selector_value)
                break
            except NoSuchElementException:
                continue
        
        if not view_button:
            logger.error("Could not find View Report button")
            logger.info("Page source saved to page_source.html for debugging")
            with open('page_source.html', 'w', encoding='utf-8') as f:
                f.write(driver.page_source)
            return None
        
        logger.info("Clicking View Report button...")
        view_button.click()
        
        # Wait for report to load - SSRS reports can take a while
        logger.info("Waiting for report to load (this may take 30-60 seconds)...")
        
        # Wait for report viewer to appear
        try:
            # SSRS report viewer usually has an iframe or specific elements
            wait.until(EC.presence_of_element_located((By.ID, "ReportViewerControl")))
            logger.info("Report viewer detected")
        except TimeoutException:
            logger.info("Report viewer not found by ID, checking for iframe...")
            try:
                # SSRS often uses iframes
                iframes = driver.find_elements(By.TAG_NAME, "iframe")
                if iframes:
                    logger.info(f"Found {len(iframes)} iframes, switching to first one")
                    driver.switch_to.frame(iframes[0])
            except:
                pass
        
        # Wait a bit more for data to load
        time.sleep(15)
        
        # Try multiple methods to get the data
        
        # Method 1: Look for Excel export button in SSRS toolbar
        logger.info("Method 1: Looking for Excel export in SSRS toolbar...")
        
        # SSRS report viewer has an export dropdown menu
        # Try to find and click the export menu first
        export_menu_selectors = [
            (By.XPATH, "//a[contains(@title, 'Export') or contains(@id, 'Export')]"),
            (By.XPATH, "//img[contains(@alt, 'Export')]/parent::a"),
            (By.CSS_SELECTOR, "a[title*='Export'], a[id*='Export']"),
        ]
        
        export_menu_clicked = False
        for selector_type, selector_value in export_menu_selectors:
            try:
                export_menu = driver.find_elements(selector_type, selector_value)
                if export_menu:
                    logger.info("Found export menu, clicking...")
                    export_menu[0].click()
                    time.sleep(2)  # Wait for dropdown to appear
                    export_menu_clicked = True
                    break
            except Exception as e:
                logger.debug(f"Export menu selector failed: {e}")
                continue
        
        # Now look for Excel option in the dropdown
        excel_selectors = [
            (By.XPATH, "//a[contains(@title, 'Excel') or contains(text(), 'Excel')]"),
            (By.XPATH, "//img[contains(@alt, 'Excel')]/parent::a"),
            (By.CSS_SELECTOR, "a[title*='Excel'], a[title*='EXCEL']"),
            (By.XPATH, "//*[contains(text(), 'Excel')]"),
        ]
        
        excel_found = False
        for selector_type, selector_value in excel_selectors:
            try:
                excel_elements = driver.find_elements(selector_type, selector_value)
                if excel_elements:
                    logger.info(f"Found Excel export element, clicking...")
                    # Scroll into view and click
                    driver.execute_script("arguments[0].scrollIntoView(true);", excel_elements[0])
                    excel_elements[0].click()
                    time.sleep(15)  # Wait longer for download
                    excel_found = True
                    break
            except Exception as e:
                logger.debug(f"Excel selector failed: {e}")
                continue
        
        # Check if file was downloaded
        download_dir = os.path.join(os.getcwd(), 'downloads')
        if excel_found:
            # Wait for download to complete
            time.sleep(10)
            max_wait = 60  # Wait up to 60 seconds for download
            waited = 0
            while waited < max_wait:
                if os.path.exists(download_dir):
                    files = os.listdir(download_dir)
                    xlsx_files = [f for f in files if f.endswith(('.xlsx', '.xls')) and not f.startswith('~')]
                    if xlsx_files:
                        # Check if file is still downloading (Chrome adds .crdownload extension)
                        downloading = [f for f in files if f.endswith('.crdownload')]
                        if not downloading:
                            latest_file = max([os.path.join(download_dir, f) for f in xlsx_files], 
                                            key=os.path.getctime)
                            logger.info(f"Downloaded Excel file: {latest_file}")
                            return latest_file
                time.sleep(2)
                waited += 2
            logger.warning("Excel download may still be in progress")
        
        # Method 2: Extract from HTML table
        logger.info("Method 2: Extracting data from HTML table...")
        
        # Switch back to main content if we were in iframe
        try:
            driver.switch_to.default_content()
        except:
            pass
        
        # Wait for table
        try:
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))
        except TimeoutException:
            logger.warning("No table found, waiting longer...")
            time.sleep(10)
        
        # Get page source
        html = driver.page_source
        
        # Save for debugging
        with open('pa_report.html', 'w', encoding='utf-8') as f:
            f.write(html)
        logger.info("Saved page HTML to pa_report.html for debugging")
        
        # Try to parse tables
        try:
            tables = pd.read_html(StringIO(html))
            if tables:
                logger.info(f"Found {len(tables)} tables in HTML")
                
                # Find the data table (usually the largest one with actual data)
                data_table = None
                max_rows = 0
                
                for table in tables:
                    if len(table) > max_rows and len(table.columns) >= 3:
                        max_rows = len(table)
                        data_table = table
                
                if data_table is not None and len(data_table) > 10:  # Should have many rows
                    logger.info(f"Found data table with {len(data_table)} rows, {len(data_table.columns)} columns")
                    logger.info(f"Columns: {list(data_table.columns)}")
                    
                    # Check if this is paginated data (only one page)
                    # Look for pagination controls
                    pagination_text = driver.find_elements(By.XPATH, "//*[contains(text(), 'of') and contains(text(), 'Find')]")
                    if pagination_text:
                        logger.warning("Data appears to be paginated - only got one page")
                        logger.info("Trying to get Excel export for all pages...")
                        # The Excel export should have all pages, so prefer that
                        # But if we got here, Excel export didn't work, so save what we have
                    
                    # Save to Excel
                    output_file = os.path.join(download_dir, 'pa_jurisdictions_scraped.xlsx')
                    data_table.to_excel(output_file, index=False)
                    logger.info(f"Saved to: {output_file}")
                    logger.warning("NOTE: This may only be one page of data. Try Excel export for full dataset.")
                    return output_file
                else:
                    logger.warning(f"Tables found but none seem to be the data table (largest has {max_rows} rows)")
        except Exception as e:
            logger.error(f"Error parsing HTML tables: {e}")
            import traceback
            traceback.print_exc()
        
        # Method 3: Try to find and click export menu
        logger.info("Method 3: Looking for export menu...")
        try:
            # SSRS export menu is often in a dropdown
            export_menu = driver.find_elements(By.XPATH, "//*[contains(@id, 'Export') or contains(@class, 'export')]")
            if export_menu:
                logger.info("Found export menu elements")
                # Try clicking and looking for Excel option
        except:
            pass
        
        logger.warning("Could not extract data automatically")
        logger.info("HTML saved to pa_report.html - you can manually inspect it")
        logger.info("Or try manually clicking Excel export in the browser window")
        return None
        
    except Exception as e:
        logger.error(f"Error during scraping: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        logger.info("Closing browser...")
        driver.quit()


def main():
    import sys
    
    headless = '--headless' in sys.argv
    
    logger.info("Starting PA DCED jurisdiction scraper...")
    logger.info("This will open a browser window and automate the data extraction")
    
    if headless:
        logger.info("Running in headless mode")
    else:
        logger.info("Running with visible browser (use --headless for background)")
    
    result = scrape_pa_jurisdictions_selenium(all_counties=True, headless=headless)
    
    if result:
        logger.info(f"✅ Successfully extracted data to: {result}")
        logger.info(f"\nNext step: Run import script")
        logger.info(f"  python import_pa_counties_jurisdictions.py {result}")
    else:
        logger.error("❌ Failed to extract data automatically")
        logger.info("\nManual approach:")
        logger.info("1. The browser should have opened")
        logger.info("2. Manually export to Excel from the report viewer")
        logger.info("3. Run: python import_pa_counties_jurisdictions.py path/to/file.xlsx")


if __name__ == "__main__":
    main()

