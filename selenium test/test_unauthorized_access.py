import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    admin_cred = {"email": f"admin_{timestamp}@test.com", "password": "123", "fullName": "Admin", "role": "Faculty"}
    unauth_cred = {"email": f"unauth_{timestamp}@test.com", "password": "123", "fullName": "Unauth User", "role": "Student"}

    requests.post(f"{base_url}/auth/register", json=admin_cred)
    res = requests.post(f"{base_url}/auth/register", json=unauth_cred)
    
    if res.status_code != 201:
        print("API ERROR during registration:", res.text)

    admin_res = requests.post(f"{base_url}/auth/login", json=admin_cred).json()
    
    if 'token' in admin_res:
        headers = {'Authorization': f'Bearer {admin_res["token"]}'}
        ws_data = {
            "name": f"Top Secret Lab {timestamp}",
            "description": "Only members can see this."
        }
        requests.post(f"{base_url}/workspace", json=ws_data, headers=headers)
        
    return unauth_cred

def test_unauthorized_access():
    print("0. Creating a secure workspace that the test user is NOT invited to...")
    unauth_user = setup_test_data()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("1. Logging in as the Unauthorized User...")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(unauth_user["email"]) 
        
        password_input = driver.find_element(By.XPATH, "//input[@type='password']")
        password_input.clear()
        password_input.send_keys(unauth_user["password"])
        
        time.sleep(1)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()

        wait.until(EC.url_contains("/profile"))
        print("[SUCCESS] Logged in successfully.")
        
        print("2. Navigating to Workspaces...")
        driver.get("http://localhost:5173/workspaces")
        
        print("3. Verifying that the secure workspace is NOT visible...")
        
        wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'empty-state') or contains(@class, 'workspace-card')]")))
        
        page_source = driver.page_source
        
        if "Top Secret Lab" not in page_source:
            print("[SUCCESS] Security check passed! Unauthorized user cannot see the private workspace.")
        else:
            raise Exception("Security breach! Unauthorized user saw a workspace.")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_unauthorized_access()
