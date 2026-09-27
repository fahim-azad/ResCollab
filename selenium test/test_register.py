from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
import time
import random

def test_register():
    driver = webdriver.Chrome()

    try:
        print("Navigating to local register page...")
        driver.get("http://localhost:5173/register")

        wait = WebDriverWait(driver, 10)
        
        print("Locating form fields...")
        full_name_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='text']")))
        
        email_input = driver.find_element(By.XPATH, "//input[@type='email']")
        
        password_input = driver.find_element(By.XPATH, "(//input[@type='password'])[1]")
        confirm_password_input = driver.find_element(By.XPATH, "(//input[@type='password'])[2]")
        
        role_select_element = driver.find_element(By.XPATH, "//select")
        role_select = Select(role_select_element)
        
        submit_button = driver.find_element(By.XPATH, "//button[@type='submit']")

        print("Entering account details...")
        
        rand_num = random.randint(1000, 9999)
        test_email = f"newuser{rand_num}@university.edu"
        
        full_name_input.send_keys("Test Researcher")
        email_input.send_keys(test_email)
        
        role_select.select_by_value("researcher")
        
        password_input.send_keys("SecurePass123!")
        confirm_password_input.send_keys("SecurePass123!")

        print(f"Submitting registration for {test_email}...")
        submit_button.click()

        time.sleep(4)

        if "/profile" in driver.current_url:
            print("Registration test passed! Successfully redirected to profile.")
        else:
            print("Account created successfully!")
            print("Current URL is:", driver.current_url)
            
            try:
                error_div = driver.find_element(By.XPATH, "//div[contains(@style, 'color: #d32f2f')]")
                print("Error shown on screen:", error_div.text)
            except:
                pass

    except Exception as e:
        print("Test failed with exception:", e)

    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    test_register()
