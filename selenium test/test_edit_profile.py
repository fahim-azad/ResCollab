from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def test_edit_profile():
    driver = webdriver.Chrome()

    try:
        # STEP 1: LOGIN
        print("1. Navigating to login page...")
        driver.get("http://localhost:5173/login")

        wait = WebDriverWait(driver, 10)
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        password_input = driver.find_element(By.XPATH, "//input[@type='password']")
        submit_login = driver.find_element(By.XPATH, "//button[@type='submit']")

        print("2. Entering valid credentials...")
        email_input.send_keys("azadi4@gmail.com") 
        password_input.send_keys("azadi4")
        submit_login.click()

        # Wait for redirect to profile
        wait.until(EC.url_contains("/profile"))
        print("[SUCCESS] Logged in and redirected to profile!")

        # STEP 2: OPEN EDIT PROFILE MODAL
        print("3. Clicking 'Edit Profile' button...")
        edit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Edit Profile')]")))
        edit_btn.click()

        # STEP 3: MODIFY FIELDS
        print("4. Waiting for edit form to appear and modifying fields...")
        # Find inputs by looking for the label right above them
        university_input = wait.until(EC.presence_of_element_located(
            (By.XPATH, "//label[contains(text(), 'University')]/following-sibling::input")
        ))
        department_input = driver.find_element(By.XPATH, "//label[contains(text(), 'Department')]/following-sibling::input")
        country_input = driver.find_element(By.XPATH, "//label[contains(text(), 'Location')]/following-sibling::input")

        # Clear existing text and enter new mock data
        university_input.clear()
        university_input.send_keys("Automated Testing Institute")
        
        department_input.clear()
        department_input.send_keys("Quality Assurance Dept")
        
        country_input.clear()
        country_input.send_keys("SeleniumLand")

        # STEP 4: SAVE CHANGES
        print("5. Saving changes...")
        save_btn = driver.find_element(By.XPATH, "//button[contains(., 'Save Profile Changes')]")
        save_btn.click()

        # STEP 5: VERIFY
        # Wait for the modal to disappear
        wait.until(EC.invisibility_of_element(save_btn))
        
        # Give the React state a second to re-render the profile header
        time.sleep(2) 

        print("✅ Edit Profile test passed! The profile was successfully updated.")

    except Exception as e:
        print("❌ Test failed with exception:", e)

    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    test_edit_profile()
