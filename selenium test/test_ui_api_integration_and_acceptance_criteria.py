import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
import time

def setup_test_data():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    # 1. Create User
    cred = {"email": f"sprint4_tester_{timestamp}@test.com", "password": "123", "fullName": "Integration Tester", "role": "Faculty"}
    requests.post(f"{base_url}/auth/register", json=cred)
    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    token = res["token"]
    user_id = res["user"]["id"]
    headers = {'Authorization': f'Bearer {token}'}
    
    # 2. Create an Idea (for Bookmarks feature)
    idea_data = {
        "title": f"Integration Idea {timestamp}",
        "description": "Idea for bookmark testing",
        "researchArea": "AI",
        "requiredSkills": "Testing",
        "expectedOutcome": "Validation",
        "requiredTeamSize": 2
    }
    requests.post(f"{base_url}/idea", json=idea_data, headers=headers)
    
    # 3. Create a Workspace (for Milestones feature)
    ws_data = {
        "name": f"Integration WS {timestamp}",
        "description": "Workspace for milestone testing"
    }
    res_ws = requests.post(f"{base_url}/workspace", json=ws_data, headers=headers).json()
    
    return cred, token, user_id, res_ws["workspaceId"]

def test_workflow():
    print("=== STARTING SPRINT 4 COMPREHENSIVE INTEGRATION TEST ===")
    print("0. Preparing test environment (Database & API Data Seeding)...")
    cred, token, user_id, workspace_id = setup_test_data()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("\n--- PHASE 1: Authentication ---")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(cred["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(cred["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] User logged in successfully.")


        print("\n--- FEATURE 1: Bookmarks API/UI Integration ---")
        driver.get("http://localhost:5173/ideas")
        
        print(" -> Bookmarking an Idea from Marketplace...")
        bookmark_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//h3[contains(., 'Integration Idea')]/..//button[@title='Bookmark']")))
        driver.execute_script("arguments[0].click();", bookmark_btn)
        time.sleep(1)
        
        print(" -> Navigating to Saved Items Dashboard...")
        driver.get("http://localhost:5173/saved")
        
        print(" -> Validating Data Persistence across UI/API...")
        wait.until(EC.presence_of_element_located((By.XPATH, "//h3[contains(., 'Integration Idea')]")))
        print("[PASS] Bookmark successfully saved in DB and retrieved in UI.")


        print("\n--- FEATURE 2: Milestone Tracking & Feedback API/UI Integration ---")
        driver.get("http://localhost:5173/workspaces")
        ws_card = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'workspace-card')]//h3[contains(., 'Integration WS')]")))
        driver.execute_script("arguments[0].click();", ws_card)
        time.sleep(1)
        
        tasks_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Tasks & Milestones')]")))
        driver.execute_script("arguments[0].click();", tasks_tab)
        
        print(" -> Creating a new Milestone...")
        new_task_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'New Task')]")))
        driver.execute_script("arguments[0].click();", new_task_btn)
        
        title_input = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal-content')]//input[@type='text']")))
        title_input.send_keys("Integration Phase 1")
        
        milestone_checkbox = driver.find_element(By.XPATH, "//input[@type='checkbox']")
        driver.execute_script("arguments[0].click();", milestone_checkbox)
        
        save_btn = driver.find_element(By.XPATH, "//button[text()='Save Task']")
        driver.execute_script("arguments[0].click();", save_btn)
        time.sleep(1)
        
        print(" -> Triggering Feedback API with Status Update...")
        feedback_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//h4[contains(., 'Integration Phase 1')]/../../..//button[contains(., 'Feedback')]")))
        driver.execute_script("arguments[0].click();", feedback_btn)
        time.sleep(1)
        
        feedback_textarea = wait.until(EC.presence_of_element_located((By.XPATH, "//h2[contains(., 'Feedback:')]/../..//textarea")))
        feedback_textarea.send_keys("Milestone complete via integration test!")
        
        status_dropdown = driver.find_element(By.XPATH, "//h2[contains(., 'Feedback:')]/../..//select")
        select_status = Select(status_dropdown)
        select_status.select_by_value("Done")
        
        post_feedback_btn = driver.find_element(By.XPATH, "//button[text()='Post Feedback']")
        driver.execute_script("arguments[0].click();", post_feedback_btn)
        time.sleep(1)
        
        close_btn = driver.find_element(By.XPATH, "//h2[contains(., 'Feedback:')]/..//button[contains(@class, 'close-btn')]")
        driver.execute_script("arguments[0].click();", close_btn)
        time.sleep(1)
        
        print(" -> Verifying UI State Synchronization...")
        task_dropdowns = driver.find_elements(By.XPATH, "//select[contains(@style, 'border: 1px solid')]")
        if Select(task_dropdowns[0]).first_selected_option.text != "Done":
            raise Exception("Task did not update to 'Done'")
        print("[PASS] Milestone Feedback successfully updated task status across UI/API.")


        print("\n--- FEATURE 3: Notifications Polling API/UI Integration ---")
        print(" -> Injecting Background Notification via API...")
        requests.post("http://localhost:5000/api/notification", 
            json={"userId": user_id, "title": "System Alert", "message": "Integration test running!", "type": "System"},
            headers={'Authorization': f'Bearer {token}'})
            
        print(" -> Waiting for UI Polling to detect new notification (up to 35s)...")
        WebDriverWait(driver, 35).until(EC.presence_of_element_located((By.XPATH, "//span[contains(@class, 'unread-badge')]")))
        
        print(" -> Navigating to Notification Center...")
        driver.get("http://localhost:5173/notifications")
        
        print(" -> Marking as Read & Validating UI State Change...")
        mark_read_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Mark as Read') or @title='Mark as read']")))
        driver.execute_script("arguments[0].click();", mark_read_btn)
        time.sleep(1)
        
        wait.until_not(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'notification-card') and contains(@class, 'unread')]//h3[contains(., 'System Alert')]")))
        print("[PASS] Notifications successfully polled, fetched, and marked as read.")

        print("\n=======================================================")
        print("[SUCCESS] ALL SPRINT 4 FEATURES VALIDATED EFFECTIVELY!")
        print("=======================================================")

    except Exception as e:
        print(f"\n[FAILED] Test crashed: {e}")

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_workflow()
