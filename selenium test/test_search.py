from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def test_search():
    driver = webdriver.Chrome()

    try:
        driver.get("http://localhost:5173/login")

        wait = WebDriverWait(driver, 10)
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        password_input = driver.find_element(By.XPATH, "//input[@type='password']")
        submit_login = driver.find_element(By.XPATH, "//button[@type='submit']")

        email_input.send_keys("azadi4@gmail.com")
        password_input.send_keys("azadi4")
        submit_login.click()

        wait.until(EC.url_contains("/profile"))

        driver.get("http://localhost:5173/search")

        search_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='text']")))
        search_btn = driver.find_element(By.XPATH, "//button[@type='submit']")

        search_input.send_keys("machine learning")

        search_btn.click()

        time.sleep(3)

    except Exception as e:
        print("Test failed with exception:", e)

    finally:
        driver.quit()

if __name__ == "__main__":
    test_search()
