import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.alert import Alert
import time

def setup_test_users():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    user_a = {"email": f"usera_{timestamp}@test.com", "password": "123", "fullName": f"Network User A {timestamp}", "role": "Student"}
    user_b = {"email": f"userb_{timestamp}@test.com", "password": "123", "fullName": f"Network User B {timestamp}", "role": "Faculty"}
    user_c = {"email": f"userc_{timestamp}@test.com", "password": "123", "fullName": f"Network User C {timestamp}", "role": "Student"}
    
    requests.post(f"{base_url}/auth/register", json=user_a)
    requests.post(f"{base_url}/auth/register", json=user_b)
    requests.post(f"{base_url}/auth/register", json=user_c)

    res_a = requests.post(f"{base_url}/auth/login", json=user_a).json()
    res_b = requests.post(f"{base_url}/auth/login", json=user_b).json()
    res_c = requests.post(f"{base_url}/auth/login", json=user_c).json()
    
    token_a = res_a["token"]
    id_b = res_b["user"]["id"]
    id_c = res_c["user"]["id"]
    
    # User A requests B and C via API
    headers_a = {'Authorization': f'Bearer {token_a}'}
    requests.post(f"{base_url}/network/connect/{id_b}", headers=headers_a)
    requests.post(f"{base_url}/network/connect/{id_c}", headers=headers_a)
    
    return user_a, user_b, user_c

def test_relationship_permissions():
    print("=== STARTING T-013.6 RELATIONSHIP PERMISSIONS TEST ===")
    print("0. Setting up Users and sending initial Connection requests...")
    user_a, user_b, user_c = setup_test_users()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("\n--- TEST 1: Connection Rejection ---")
        print("1. Logging in as User B...")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(user_b["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(user_b["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        
        print("2. Navigating to Network Hub...")
        network_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/network')]")))
        driver.execute_script("arguments[0].click();", network_link)
        
        print("3. Rejecting User A's Connection Request...")
        user_a_name = wait.until(EC.presence_of_element_located((By.XPATH, f"//h3[contains(., '{user_a['fullName']}')]")))
        reject_btn = driver.find_element(By.XPATH, "//button[contains(., 'Reject')]")
        driver.execute_script("arguments[0].click();", reject_btn)
        time.sleep(1)
        
        print("4. Verifying User A is NOT in Connections...")
        conns_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Connections')]")))
        driver.execute_script("arguments[0].click();", conns_tab)
        time.sleep(1)
        wait.until_not(EC.presence_of_element_located((By.XPATH, f"//h3[contains(., '{user_a['fullName']}')]")))
        print("[PASS] Rejection successfully prevented connection.")
        
        print("\n--- TEST 2: Removing an Established Connection ---")
        print("5. Logging out User B...")
        driver.execute_script("localStorage.clear();")
        driver.get("http://localhost:5173/login")
        wait.until(EC.url_contains("/login"))
        
        print("6. Logging in as User C...")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(user_c["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(user_c["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        
        print("7. Navigating to Network Hub...")
        network_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/network')]")))
        driver.execute_script("arguments[0].click();", network_link)
        
        print("8. Accepting User A's Connection Request...")
        user_a_name = wait.until(EC.presence_of_element_located((By.XPATH, f"//h3[contains(., '{user_a['fullName']}')]")))
        accept_btn = driver.find_element(By.XPATH, "//button[contains(., 'Accept')]")
        driver.execute_script("arguments[0].click();", accept_btn)
        time.sleep(1)
        
        print("9. Verifying User A is in Connections...")
        conns_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Connections')]")))
        driver.execute_script("arguments[0].click();", conns_tab)
        wait.until(EC.presence_of_element_located((By.XPATH, f"//h3[contains(., '{user_a['fullName']}')]")))
        
        print("10. Clicking 'Remove Connection'...")
        remove_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Remove Connection')]")))
        driver.execute_script("arguments[0].click();", remove_btn)
        
        # Handle browser alert
        print("11. Accepting confirmation alert...")
        alert = wait.until(EC.alert_is_present())
        alert.accept()
        time.sleep(1)
        
        print("12. Verifying User A is successfully removed from Connections...")
        wait.until_not(EC.presence_of_element_located((By.XPATH, f"//h3[contains(., '{user_a['fullName']}')]")))
        print("[PASS] Connection successfully severed and removed from UI.")
        
        print("\n=======================================================")
        print("[SUCCESS] ALL T-013.6 RELATIONSHIP PERMISSIONS VALIDATED!")
        print("=======================================================")

    except Exception as e:
        print(f"\n[FAILED] Test crashed: {e}")

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_relationship_permissions()
