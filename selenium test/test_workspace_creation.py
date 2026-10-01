import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    admin_cred = {"email": f"creator_{timestamp}@test.com", "password": "123", "fullName": "Ispahani Creator", "role": "Faculty"}
    member_cred = {"email": f"teammate_{timestamp}@test.com", "password": "123", "fullName": "Ispahani Teammate", "role": "Student"}

    requests.post(f"{base_url}/auth/register", json=admin_cred)
    requests.post(f"{base_url}/auth/register", json=member_cred)

    member_res = requests.post(f"{base_url}/auth/login", json=member_cred).json()
    member_id = member_res["user"]["id"]
    
    return admin_cred, member_id

def test_workspace_creation():
    print("0. Generating fresh users for Ispahani's test...")
    admin, member_id = setup_test_data()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("1. Logging in as Workspace Creator...")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.send_keys(admin["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(admin["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()

        wait.until(EC.url_contains("/profile"))
        
        print("2. Navigating to Workspaces...")
        driver.get("http://localhost:5173/workspaces")
        
        print("3. Creating a new Private Workspace...")
        new_ws_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'New Workspace')]")))
        new_ws_btn.click()
        
        ws_name_input = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal-content')]//input[@type='text']")))
        ws_name_input.send_keys("Ispahani Test Workspace")
        
        create_btn = driver.find_element(By.XPATH, "//button[text()='Create Workspace']")
        create_btn.click()
        
        time.sleep(2)
        
        print("4. Selecting the new Workspace...")
        ws_card = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'workspace-card')]")))
        ws_card.click()
        
        print(f"5. Adding the secondary user (ID: {member_id}) as a Member...")
        add_member_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='number']")))
        add_member_input.send_keys(str(member_id))
        
        add_member_btn = driver.find_element(By.XPATH, "//button[contains(., 'Add Member')]")
        add_member_btn.click()
        
        time.sleep(2)
        print("[SUCCESS] Workspace created and member added successfully!")
        
    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_workspace_creation()
