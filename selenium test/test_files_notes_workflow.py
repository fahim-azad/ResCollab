import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    cred = {"email": f"adiba_{timestamp}@test.com", "password": "123", "fullName": "Adiba Binta", "role": "Student"}
    requests.post(f"{base_url}/auth/register", json=cred)

    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    
    if 'token' in res:
        headers = {'Authorization': f'Bearer {res["token"]}'}
        ws_data = {
            "name": f"Adiba Collab Space {timestamp}",
            "description": "Notes and Files test"
        }
        requests.post(f"{base_url}/workspace", json=ws_data, headers=headers)
        
    return cred

def test_files_notes_workflow():
    print("0. Preparing user and workspace...")
    cred = setup_test_data()
    
    with open("dummy_upload.txt", "w") as f:
        f.write("Test file for selenium workflow.")
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("1. Logging in...")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(cred["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(cred["password"])
        time.sleep(1)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()

        wait.until(EC.url_contains("/profile"))
        
        print("2. Navigating to Workspaces...")
        driver.get("http://localhost:5173/workspaces")
        
        print("3. Opening Workspace & navigating to Files & Notes tab...")
        ws_card = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'workspace-card')]")))
        ws_card.click()
        
        notes_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[text()='Files & Notes']")))
        notes_tab.click()
        
        print("4. Creating a new Note...")
        new_note_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'New Note')]")))
        new_note_btn.click()
        
        title_input = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal-content')]//input[@type='text']")))
        title_input.send_keys("Sprint Planning Notes")
        
        desc_input = driver.find_element(By.XPATH, "//div[contains(@class, 'modal-content')]//textarea")
        desc_input.send_keys("We need to complete the selenium tests today.")
        
        save_btn = driver.find_element(By.XPATH, "//button[text()='Save Note']")
        driver.execute_script("arguments[0].click();", save_btn)
        
        time.sleep(2)
        
        print("5. Uploading a File...")
        file_input = driver.find_element(By.XPATH, "//input[@type='file']")
        file_path = os.path.abspath("dummy_upload.txt")
        file_input.send_keys(file_path)
        
        time.sleep(3)
        
        print("6. Verifying Notes and Files...")
        page_source = driver.page_source
        
        if "Sprint Planning Notes" in page_source and "dummy_upload.txt" in page_source:
            print("[SUCCESS] Files and Notes workflow successfully validated!")
        else:
            raise Exception("Note or File did not appear in the DOM.")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()
        if os.path.exists("dummy_upload.txt"):
            os.remove("dummy_upload.txt")

if __name__ == "__main__":
    test_files_notes_workflow()
