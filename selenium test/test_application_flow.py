import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    
    timestamp = int(time.time())
    fac_cred = {"email": f"prof_{timestamp}@test.com", "password": "123", "fullName": "Prof Test", "role": "Faculty"}
    stu_cred = {"email": f"student_{timestamp}@test.com", "password": "123", "fullName": "Student Test", "role": "Student"}

    requests.post(f"{base_url}/auth/register", json=fac_cred)
    requests.post(f"{base_url}/auth/register", json=stu_cred)

    fac_res = requests.post(f"{base_url}/auth/login", json=fac_cred).json()
    stu_res = requests.post(f"{base_url}/auth/login", json=stu_cred).json()

    if 'token' in fac_res:
        headers = {'Authorization': f'Bearer {fac_res["token"]}'}
        proj_data = {
            "title": "Automated Selenium Project",
            "description": "Test project created automatically by python",
            "department": "Computer Science",
            "requiredSkills": "Python, Selenium",
            "maxStudents": 5,
            "isFunded": False
        }
        requests.post(f"{base_url}/openproject", json=proj_data, headers=headers)
        
    return stu_cred

def test_application_submission():
    print("0. Seeding the database with a test project...")
    student = setup_test_data()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("1. Navigating to login page...")
        driver.get("http://localhost:5173/login")

        print("2. Entering student credentials...")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        password_input = driver.find_element(By.XPATH, "//input[@type='password']")
        submit_login = driver.find_element(By.XPATH, "//button[@type='submit']")

        email_input.send_keys(student["email"]) 
        password_input.send_keys(student["password"])
        submit_login.click()

        wait.until(EC.url_contains("/profile"))
        print("[SUCCESS] Logged in!")

        print("3. Navigating to Project Marketplace...")
        driver.get("http://localhost:5173/projects")

        print("4. Opening the application form...")
        apply_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "(//button[contains(., 'Apply for Position')])[1]")))
        apply_btn.click()

        print("5. Writing cover letter...")
        cover_letter = wait.until(EC.presence_of_element_located((By.TAG_NAME, "textarea")))
        cover_letter.send_keys("Hello! I am highly interested in joining this research project. I have extensive experience in React and .NET.")

        print("6. Submitting application...")
        submit_application_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Submit Application')]")
        submit_application_btn.click()

        time.sleep(2)
        print("[SUCCESS] Application submitted successfully!")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_application_submission()
