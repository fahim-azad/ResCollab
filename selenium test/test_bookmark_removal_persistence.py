import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    cred = {"email": f"bookmark_tester_{timestamp}@test.com", "password": "123", "fullName": "Bookmark Tester", "role": "Faculty"}
    requests.post(f"{base_url}/auth/register", json=cred)

    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    
    if 'token' in res:
        headers = {'Authorization': f'Bearer {res["token"]}'}
        
        # Create an Idea to bookmark
        idea_data = {
            "title": f"Persistence Test Idea {timestamp}",
            "description": "Testing removal and persistence",
            "researchArea": "CS",
            "requiredSkills": "Testing",
            "expectedOutcome": "Validation",
            "requiredTeamSize": 2
        }
        requests.post(f"{base_url}/idea", json=idea_data, headers=headers)
        
    return cred, res["token"]

def test_workflow():
    print("0. Setting up test user and idea...")
    cred, token = setup_test_data()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("1. Logging in...")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(cred["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(cred["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()

        wait.until(EC.url_contains("/profile"))
        
        print("2. Navigating to Ideas...")
        driver.get("http://localhost:5173/ideas")
        
        print("3. Bookmarking the Idea...")
        bookmark_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//h3[contains(., 'Persistence Test Idea')]/..//button[@title='Bookmark']")))
        driver.execute_script("arguments[0].click();", bookmark_btn)
        time.sleep(1)
        
        print("4. Navigating to Saved page...")
        saved_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/saved')]")))
        driver.execute_script("arguments[0].click();", saved_link)
        
        print("5. Verifying Idea is in Saved list...")
        wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Persistence Test Idea')]")))
        
        print("6. Removing the bookmark from Saved Page...")
        remove_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//h3[contains(., 'Persistence Test Idea')]/..//button[contains(@class, 'remove-btn')]")))
        driver.execute_script("arguments[0].click();", remove_btn)
        
        print("7. Verifying Idea is no longer in Saved list...")
        wait.until_not(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Persistence Test Idea')]")))
        
        print("8. Navigating back to Ideas...")
        driver.get("http://localhost:5173/ideas")
        
        print("9. Verifying bookmark state is persistent (button should be 'Bookmark', not 'Remove Bookmark')...")
        wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Persistence Test Idea')]/..//button[@title='Bookmark']")))
        
        print("[SUCCESS] Bookmark creation, removal, and persistence successfully validated!")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_workflow()
