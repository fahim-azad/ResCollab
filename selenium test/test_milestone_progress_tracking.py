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
    
    cred = {"email": f"progress_tester_{timestamp}@test.com", "password": "123", "fullName": "Progress Tester", "role": "Faculty"}
    requests.post(f"{base_url}/auth/register", json=cred)

    res = requests.post(f"{base_url}/auth/login", json=cred).json()
    
    if 'token' in res:
        headers = {'Authorization': f'Bearer {res["token"]}'}
        
        ws_data = {
            "name": f"Progress Tracking WS {timestamp}",
            "description": "Workspace for progress tracking test",
            "openProjectId": None
        }
        res_ws = requests.post(f"{base_url}/workspace", json=ws_data, headers=headers).json()
        workspace_id = res_ws["workspaceId"]
        
    return cred, workspace_id

def test_workflow():
    print("0. Setting up test user and workspace...")
    cred, workspace_id = setup_test_data()
    
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
        
        print("2.5. Opening the specific Workspace...")
        ws_card = wait.until(EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'workspace-card')]//h3[contains(., 'Progress Tracking WS')]")))
        driver.execute_script("arguments[0].click();", ws_card)
        time.sleep(1)
        
        print("3. Opening Tasks Tab...")
        tasks_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Tasks & Milestones')]")))
        driver.execute_script("arguments[0].click();", tasks_tab)
        
        print("4. Creating Task 1...")
        new_task_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'New Task')]")))
        driver.execute_script("arguments[0].click();", new_task_btn)
        
        title_input = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal-content')]//input[@type='text']")))
        title_input.send_keys("Task 1")
        driver.execute_script("arguments[0].click();", driver.find_element(By.XPATH, "//button[text()='Save Task']"))
        time.sleep(1)
        
        print("5. Creating Task 2...")
        driver.execute_script("arguments[0].click();", wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'New Task')]"))))
        title_input2 = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'modal-content')]//input[@type='text']")))
        title_input2.send_keys("Task 2")
        driver.execute_script("arguments[0].click();", driver.find_element(By.XPATH, "//button[text()='Save Task']"))
        time.sleep(1)
        
        print("6. Verifying Initial Progress (0%)...")
        progress_text = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(., '0%') and contains(@style, 'font-size: 1.5rem')]")))
        print("   Found 0% progress!")
        
        print("7. Marking Task 1 as Done...")
        # Find the first select dropdown for tasks
        task_status_dropdowns = driver.find_elements(By.XPATH, "//select[contains(@style, 'border: 1px solid')]")
        select_task1 = Select(task_status_dropdowns[0])
        select_task1.select_by_value("Done")
        time.sleep(2) # wait for fetch
        
        print("8. Verifying Progress (50%)...")
        progress_text_50 = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(., '50%') and contains(@style, 'font-size: 1.5rem')]")))
        print("   Found 50% progress!")
        
        print("9. Marking Task 2 as Done...")
        task_status_dropdowns = driver.find_elements(By.XPATH, "//select[contains(@style, 'border: 1px solid')]")
        select_task2 = Select(task_status_dropdowns[1])
        select_task2.select_by_value("Done")
        time.sleep(2)
        
        print("10. Verifying Progress (100%)...")
        progress_text_100 = wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(., '100%') and contains(@style, 'font-size: 1.5rem')]")))
        print("   Found 100% progress!")
        
        print("[SUCCESS] Milestone/Task Progress Calculation successfully validated!")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_workflow()
