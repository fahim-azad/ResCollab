import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    cred = {"email": f"notif_tester_{timestamp}@test.com", "password": "123", "fullName": "Notif Tester", "role": "Faculty"}
    requests.post(f"{base_url}/auth/register", json=cred)

    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    
    if 'token' in res:
        headers = {'Authorization': f'Bearer {res["token"]}'}
        
        # Create an Idea to bookmark
        idea_data = {
            "title": f"Quantum Computing {timestamp}",
            "description": "Test Idea",
            "researchArea": "Physics",
            "requiredSkills": "Math",
            "expectedOutcome": "Paper",
            "requiredTeamSize": 2
        }
        requests.post(f"{base_url}/idea", json=idea_data, headers=headers)
        
    return cred, str(res["user"]["id"]), res["token"]

def test_workflow():
    print("0. Setting up test user and idea...")
    cred, user_id, token = setup_test_data()
    
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
        # Find the bookmark button on the idea card
        bookmark_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//h3[contains(., 'Quantum Computing')]/..//button[@title='Bookmark']")))
        driver.execute_script("arguments[0].click();", bookmark_btn)
        
        time.sleep(1) # Wait for bookmark to process
        
        print("4. Navigating to Saved page...")
        saved_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/saved')]")))
        driver.execute_script("arguments[0].click();", saved_link)
        
        print("5. Verifying Idea is in Saved list...")
        wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Quantum Computing')]")))
        
        print("6. Creating a Notification via API...")
        notif_data = {
            "userId": int(user_id),
            "title": "Welcome to ResCollab",
            "message": "We are glad you are here!",
            "type": "System"
        }
        requests.post("http://localhost:5000/api/notification", json=notif_data, headers={'Authorization': f'Bearer {token}'})
        
        print("7. Waiting for Sidebar badge to appear (polling is every 30s)...")
        # Sidebar polling is 30s, we wait up to 35s
        badge = WebDriverWait(driver, 35).until(EC.presence_of_element_located((By.XPATH, "//a[contains(@href, '/notifications')]//span[contains(@class, 'unread-badge')]")))
        print(f"Badge appeared with text: {badge.text}")
        
        print("8. Navigating to Notifications...")
        notif_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/notifications')]")))
        driver.execute_script("arguments[0].click();", notif_link)
        
        print("9. Verifying unread notification is present...")
        notif_card = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'notification-card') and contains(@class, 'unread')]//h3[contains(., 'Welcome to ResCollab')]")))
        
        print("10. Marking notification as read...")
        mark_read_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'notification-card') and contains(@class, 'unread')]//button[contains(., 'Mark as Read') or @title='Mark as read']")
        driver.execute_script("arguments[0].click();", mark_read_btn)
        
        time.sleep(1)
        
        print("11. Verifying notification is marked as read (no longer unread class)...")
        wait.until_not(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'notification-card') and contains(@class, 'unread')]//h3[contains(., 'Welcome to ResCollab')]")))
        
        print("[SUCCESS] Notification and bookmark workflow successfully validated!")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_workflow()
