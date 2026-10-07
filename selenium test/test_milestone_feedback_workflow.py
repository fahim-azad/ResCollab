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
    
    cred = {"email": f"feedback_tester_{timestamp}@test.com", "password": "123", "fullName": "Feedback Tester", "role": "Student"}
    requests.post(f"{base_url}/auth/register", json=cred)

    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    
    if 'token' in res:
        headers = {'Authorization': f'Bearer {res["token"]}'}
        ws_data = {
            "name": f"Feedback Workspace {timestamp}",
            "description": "Milestone Feedback test"
        }
        requests.post(f"{base_url}/workspace", json=ws_data, headers=headers)
        
    return cred, str(res["user"]["id"])

def test_milestone_feedback_workflow():
    print("0. Preparing task user and workspace...")
    cred, user_id = setup_test_data()
    
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
        
        print("2. Navigating to Workspaces...")
        driver.get("http://localhost:5173/workspaces")
        
        print("3. Opening Workspace & navigating to Tasks tab...")
        ws_card = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'workspace-card')]")))
        ws_card.click()
        
        tasks_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[text()='Tasks & Milestones']")))
        tasks_tab.click()
        
        print("4. Creating a new Milestone Task...")
        new_task_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'New Task')]")))
        new_task_btn.click()
        
        title_input = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal-content')]//input[@type='text']")))
        title_input.send_keys("Phase 1 Milestone")
        
        desc_input = driver.find_element(By.XPATH, "//div[contains(@class, 'modal-content')]//textarea")
        desc_input.send_keys("Testing feedback system")
        
        assign_select = Select(driver.find_element(By.XPATH, "//div[contains(@class, 'modal-content')]//select"))
        assign_select.select_by_value(user_id)
        
        milestone_cb = driver.find_element(By.XPATH, "//input[@type='checkbox']")
        driver.execute_script("arguments[0].click();", milestone_cb)
        
        save_btn = driver.find_element(By.XPATH, "//button[text()='Save Task']")
        driver.execute_script("arguments[0].click();", save_btn)
        
        time.sleep(2)
        
        print("5. Opening Feedback Modal...")
        # Find the "Feedback" button
        feedback_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Feedback')]")))
        driver.execute_script("arguments[0].click();", feedback_btn)
        
        time.sleep(1)
        print("6. Posting Feedback...")
        feedback_textarea = wait.until(EC.presence_of_element_located((By.XPATH, "//h2[contains(., 'Feedback:')]/../..//textarea")))
        feedback_textarea.send_keys("Looks good, but needs more documentation.")
        
        post_feedback_btn = driver.find_element(By.XPATH, "//button[text()='Post Feedback']")
        driver.execute_script("arguments[0].click();", post_feedback_btn)
        
        time.sleep(2)
        
        print("7. Verifying Feedback is visible...")
        # Check if the text we just posted is in the modal
        modal_body = driver.find_element(By.XPATH, "//h2[contains(., 'Feedback:')]/../..").text
        
        if "Looks good, but needs more documentation." in modal_body:
            print("[SUCCESS] Milestone feedback workflow successfully validated!")
        else:
            raise Exception("Feedback text was not found in the modal after posting!")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_milestone_feedback_workflow()
