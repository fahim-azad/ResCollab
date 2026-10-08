import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def setup_test_users():
    base_url = "http://localhost:5000/api"
    timestamp = int(time.time())
    
    user_a = {"email": f"usera_{timestamp}@test.com", "password": "123", "fullName": f"Network User A {timestamp}", "role": "Student"}
    user_b = {"email": f"userb_{timestamp}@test.com", "password": "123", "fullName": f"Network User B {timestamp}", "role": "Faculty"}
    
    requests.post(f"{base_url}/auth/register", json=user_a)
    requests.post(f"{base_url}/auth/register", json=user_b)

    res_a = requests.post(f"{base_url}/auth/login", json=user_a).json()
    res_b = requests.post(f"{base_url}/auth/login", json=user_b).json()
    
    return user_a, str(res_a["user"]["id"]), user_b, str(res_b["user"]["id"])

def test_network_workflow():
    print("0. Setting up test users...")
    user_a, id_a, user_b, id_b = setup_test_users()
    
    driver = webdriver.Chrome()
    wait = WebDriverWait(driver, 10)

    try:
        print("1. Logging in as User A...")
        driver.get("http://localhost:5173/login")
        
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(user_a["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(user_a["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()

        wait.until(EC.url_contains("/profile"))
        
        print("2. Navigating to User B's profile...")
        driver.get(f"http://localhost:5173/profile/{id_b}")
        
        # Wait for profile to load (check name)
        wait.until(EC.presence_of_element_located((By.XPATH, f"//h1[contains(., '{user_b['fullName']}')]")))
        
        print("3. Following User B...")
        follow_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Follow')]")))
        driver.execute_script("arguments[0].click();", follow_btn)
        
        # Should change to Following
        wait.until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Following')]")))
        
        print("4. Sending Connection Request to User B...")
        connect_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Connect')]")))
        driver.execute_script("arguments[0].click();", connect_btn)
        
        # Should change to Pending
        wait.until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'Pending')]")))
        
        print("5. Logging out User A...")
        driver.execute_script("localStorage.clear();")
        driver.get("http://localhost:5173/login")
        wait.until(EC.url_contains("/login"))
        
        print("6. Logging in as User B...")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(user_b["email"]) 
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(user_b["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()

        wait.until(EC.url_contains("/profile"))
        
        print("7. Navigating to Network Hub...")
        network_link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/network')]")))
        driver.execute_script("arguments[0].click();", network_link)
        
        print("8. Checking Pending Requests and Accepting...")
        # Since 'Pending Requests' is the default tab, we just check for User A's name
        user_a_name = wait.until(EC.presence_of_element_located((By.XPATH, f"//h3[contains(., '{user_a['fullName']}')]")))
        
        accept_btn = driver.find_element(By.XPATH, "//button[contains(., 'Accept')]")
        driver.execute_script("arguments[0].click();", accept_btn)
        
        time.sleep(1) # wait for refresh
        
        print("9. Verifying Connection in Connections tab...")
        conns_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Connections')]")))
        driver.execute_script("arguments[0].click();", conns_tab)
        
        # Look for User A in the connections tab
        wait.until(EC.presence_of_element_located((By.XPATH, f"//div[contains(@class, 'network-grid')]//h3[contains(., '{user_a['fullName']}')]")))
        
        print("10. Verifying Follower in Followers tab...")
        followers_tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Followers')]")))
        driver.execute_script("arguments[0].click();", followers_tab)
        
        wait.until(EC.presence_of_element_located((By.XPATH, f"//div[contains(@class, 'network-grid')]//h3[contains(., '{user_a['fullName']}')]")))
        
        print("[SUCCESS] Follow and connection workflow successfully validated!")

    except Exception as e:
        print("[FAILED] Test failed with exception:", e)

    finally:
        print("Closing browser...")
        time.sleep(2)
        driver.quit()

if __name__ == "__main__":
    test_network_workflow()
