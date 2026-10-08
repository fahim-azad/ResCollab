import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    # 1. Create User
    cred = {"email": f"persistence_tester_{timestamp}@test.com", "password": "123", "fullName": "Persistence Tester", "role": "Faculty"}
    requests.post(f"{base_url}/auth/register", json=cred)
    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    token = res["token"]
    user_id = res["user"]["id"]
    headers = {'Authorization': f'Bearer {token}'}
    
    # 2. Create Idea (for Bookmarks)
    idea_data = {
        "title": f"Persistent Idea {timestamp}",
        "description": "Will it survive a refresh?",
        "researchArea": "CS",
        "requiredSkills": "Persistence",
        "expectedOutcome": "Validation",
        "requiredTeamSize": 2
    }
    requests.post(f"{base_url}/idea", json=idea_data, headers=headers)
    
    # 3. Create Notification (API injection)
    requests.post(f"{base_url}/notification", 
        json={"userId": user_id, "title": "Persistence Test", "message": "Does state persist?", "type": "System"},
        headers=headers)
        
    return cred, token, user_id

def test_persistence():
    print("=== STARTING T-014.7 PERSISTENCE VALIDATION ===")
    print("0. Preparing user, idea, and unread notification in DB...")
    cred, token, user_id = setup_test_data()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("\n--- TEST 1: Initial State Mutation ---")
        driver.get("http://localhost:5173/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.send_keys(cred["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(cred["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        
        print("1. Bookmarking Idea...")
        driver.get("http://localhost:5173/ideas")
        bookmark_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//h3[contains(., 'Persistent Idea')]/..//button[@title='Bookmark']")))
        driver.execute_script("arguments[0].click();", bookmark_btn)
        time.sleep(1)
        
        print("2. Marking Notification as Read...")
        driver.get("http://localhost:5173/notifications")
        mark_read_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Mark as Read') or @title='Mark as read']")))
        driver.execute_script("arguments[0].click();", mark_read_btn)
        time.sleep(1)
        
        
        print("\n--- TEST 2: Validating Persistence Across Sessions (Hard Reload) ---")
        print("3. Logging out to clear local state...")
        driver.execute_script("localStorage.clear();")
        driver.get("http://localhost:5173/login")
        wait.until(EC.url_contains("/login"))
        
        print("4. Logging back in (forcing full state fetch from DB)...")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.send_keys(cred["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(cred["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        
        print("5. Verifying Bookmark Persistence...")
        driver.get("http://localhost:5173/saved")
        wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Persistent Idea')]")))
        print("[PASS] Bookmark safely retrieved from DB after session clear.")
        
        print("6. Verifying Notification 'Read' State Persistence...")
        driver.get("http://localhost:5173/notifications")
        # Ensure it doesn't have 'unread' class anymore, but is still listed
        wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Persistence Test')]")))
        # It should NOT be unread
        wait.until_not(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'notification-card') and contains(@class, 'unread')]//h3[contains(., 'Persistence Test')]")))
        print("[PASS] Notification state safely persisted as 'Read'.")
        
        print("\n=======================================================")
        print("[SUCCESS] ALL T-014.7 PERSISTENCE CRITERIA VALIDATED!")
        print("=======================================================")

    except Exception as e:
        print(f"\n[FAILED] Test crashed: {e}")

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_persistence()
