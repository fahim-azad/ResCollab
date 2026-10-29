import os
import sys
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"

def create_test_user(role="Student", prefix="cold_user"):
    timestamp = int(time.time() * 1000)
    user = {
        "email": f"{prefix}_{timestamp}@rescollab.test",
        "password": "Password123!",
        "fullName": f"User {prefix.replace('_', ' ').title()} {timestamp}",
        "role": role
    }

    # Register
    reg_res = requests.post(f"{BASE_API_URL}/auth/register", json=user)
    assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.text}"

    # Login
    login_res = requests.post(f"{BASE_API_URL}/auth/login", json=user)
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    login_data = login_res.json()

    return {
        "email": user["email"],
        "password": user["password"],
        "fullName": user["fullName"],
        "role": role,
        "token": login_data.get("token", ""),
        "id": login_data.get("user", {}).get("id")
    }

def set_react_input(driver, element, value):
    driver.execute_script("""
        var elem = arguments[0];
        var val = arguments[1];
        var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(elem, val);
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
    """, element, str(value))

def test_recommendation_empty_profile_insufficient_data():
    print("==========================================================================================")
    print("=== STARTING T-019.7: RECOMMENDATION EMPTY-PROFILE & INSUFFICIENT DATA SUITE           ===")
    print("==========================================================================================")

    # =========================================================================
    # PHASE 1: API LEVEL - PURE COLD START & NULL/EMPTY PROFILE RESILIENCE
    # =========================================================================
    print("\n--- PHASE 1: API LEVEL - PURE COLD START & EMPTY PROFILE RESILIENCE ---")

    cold_user = create_test_user(role="Student", prefix="cold_pure")
    cold_headers = {
        "Authorization": f"Bearer {cold_user['token']}",
        "Content-Type": "application/json"
    }

    print(f"1. Querying /api/recommendation/all for fresh user #{cold_user['id']} (Empty profile)...")
    res_all = requests.get(f"{BASE_API_URL}/recommendation/all", headers=cold_headers)
    assert res_all.status_code == 200, f"Expected 200 for cold start user, got {res_all.status_code}: {res_all.text}"

    data_all = res_all.json()
    assert data_all["hasSufficientProfileData"] is False, "Expected hasSufficientProfileData to be False for empty profile!"
    assert data_all["guidanceMessage"] is not None, "Expected guidance message for empty profile!"
    assert any(w in data_all["guidanceMessage"].lower() for w in ["interests", "skills", "profile", "complete"]), (
        f"Unexpected guidance message: {data_all['guidanceMessage']}"
    )

    # Verify fallback lists are not null and did not crash the server
    assert isinstance(data_all["supervisors"], list), "Supervisors must be a list"
    assert isinstance(data_all["teammates"], list), "Teammates must be a list"
    assert isinstance(data_all["researchers"], list), "Researchers must be a list"
    assert isinstance(data_all["publications"], list), "Publications must be a list"
    assert isinstance(data_all["projects"], list), "Projects must be a list"

    # Verify baseline readiness in primary skill gap
    assert data_all["primarySkillGap"] is not None
    assert data_all["primarySkillGap"]["readinessScore"] >= 15
    assert data_all["primarySkillGap"]["currentSkills"] == ""
    print(f"[PASS] Cold start handled gracefully: hasSufficientProfileData=False, guidance message provided, "
          f"fallback recommendations returned without server exception.")

    print("2. Validating individual category endpoints for empty profile...")
    for endpoint in ["supervisors", "teammates", "researchers", "papers", "projects"]:
        r = requests.get(f"{BASE_API_URL}/recommendation/{endpoint}", headers=cold_headers)
        assert r.status_code == 200, f"Endpoint {endpoint} failed for empty profile: {r.status_code}"
        items = r.json()
        assert isinstance(items, list)
        print(f"   - /recommendation/{endpoint}: 200 OK ({len(items)} fallback items returned)")
    print("[PASS] All individual recommendation endpoints handle empty profile gracefully.")

    print("3. Validating Skill Gap Analysis with empty profile skills...")
    gap_res = requests.get(f"{BASE_API_URL}/recommendation/skill-gap", headers=cold_headers)
    assert gap_res.status_code == 200
    gap_data = gap_res.json()
    assert gap_data["currentSkills"] == ""
    assert len(gap_data["missingSkills"]) > 0
    assert gap_data["readinessScore"] >= 15
    print(f"[PASS] Skill gap evaluated with empty skills: Readiness {gap_data['readinessScore']}%, Missing: {gap_data['missingSkills'][:40]}...")

    # =========================================================================
    # PHASE 2: API LEVEL - ASYMMETRIC / PARTIAL DATA PROFILES
    # =========================================================================
    print("\n--- PHASE 2: API LEVEL - ASYMMETRIC / PARTIALLY INCOMPLETE PROFILES ---")

    # Case A: Interests Only, Zero Skills
    print("1. Testing Profile with Interests only (0 Skills)...")
    interests_user = create_test_user(role="Student", prefix="interests_only")
    interests_headers = {"Authorization": f"Bearer {interests_user['token']}", "Content-Type": "application/json"}
    requests.put(f"{BASE_API_URL}/profile", headers=interests_headers, json={
        "interests": "Bioinformatics, Genomics, Structural Biology",
        "skills": ""
    })

    res_int = requests.get(f"{BASE_API_URL}/recommendation/all", headers=interests_headers).json()
    assert res_int["hasSufficientProfileData"] is True, "User with research interests must have sufficient data flag True"
    assert res_int["guidanceMessage"] is None, "Guidance message must be None when profile has interests"

    # Projects matching when user has no skills: missingSkills should contain project's required skills
    if len(res_int["projects"]) > 0:
        first_proj = res_int["projects"][0]
        assert len(first_proj["matchedSkills"]) == 0, "Expected 0 matched skills when user has 0 skills"
        assert len(first_proj["missingSkills"]) > 0, "Expected missing skills to be populated"
    print("[PASS] Profile with interests-only evaluated correctly.")

    # Case B: Skills Only, Zero Interests
    print("2. Testing Profile with Skills only (0 Interests)...")
    skills_user = create_test_user(role="Student", prefix="skills_only")
    skills_headers = {"Authorization": f"Bearer {skills_user['token']}", "Content-Type": "application/json"}
    requests.put(f"{BASE_API_URL}/profile", headers=skills_headers, json={
        "interests": "",
        "skills": "Python, Docker, PyTorch, React"
    })

    res_skills = requests.get(f"{BASE_API_URL}/recommendation/all", headers=skills_headers).json()
    assert res_skills["hasSufficientProfileData"] is True, "User with technical skills must have sufficient data flag True"
    assert res_skills["guidanceMessage"] is None

    # Publications matching uses skills as query tokens
    if len(res_skills["publications"]) > 0:
        top_pub = res_skills["publications"][0]
        assert top_pub["matchScore"] >= 25
    print("[PASS] Profile with skills-only evaluated correctly.")

    # Case C: Unaffiliated User (Missing University and Department)
    print("3. Testing Unaffiliated Profile (Missing University & Department)...")
    unaffil_user = create_test_user(role="Student", prefix="unaffiliated")
    unaffil_headers = {"Authorization": f"Bearer {unaffil_user['token']}", "Content-Type": "application/json"}
    requests.put(f"{BASE_API_URL}/profile", headers=unaffil_headers, json={
        "interests": "Artificial Intelligence",
        "skills": "Python",
        "university": "",
        "department": ""
    })

    sups_unaffil = requests.get(f"{BASE_API_URL}/recommendation/supervisors", headers=unaffil_headers)
    assert sups_unaffil.status_code == 200, "Affiliation calculation failed for empty university/department"
    print("[PASS] Unaffiliated user scoring handled safely without null-reference errors.")

    # =========================================================================
    # PHASE 3: SELENIUM UI - FRESH USER COLD START GUIDANCE & RESOLUTION
    # =========================================================================
    print("\n--- PHASE 3: SELENIUM UI - COLD START GUIDANCE BANNER & RESOLUTION ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    try:
        print(f"1. Logging in as Cold-Start User '{cold_user['email']}'...")
        driver.get(f"{FRONTEND_URL}/login")

        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(cold_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(cold_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] User logged in.")

        print("2. Navigating to Recommendations Hub...")
        driver.get(f"{FRONTEND_URL}/recommendations")
        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))

        # Verify Cold Start Guidance Banner
        guidance_banner = wait.until(EC.presence_of_element_located((By.ID, "banner-profile-guidance")))
        banner_text = guidance_banner.text.lower()
        assert "boost your recommendation accuracy" in banner_text
        assert "complete profile" in banner_text
        print("[PASS] Cold start guidance banner correctly displayed for user with empty profile.")

        # Click Complete Profile in Guidance Banner
        print("3. Clicking 'Complete Profile' action button in banner...")
        complete_btn = guidance_banner.find_element(By.CLASS_NAME, "btn-guidance-action")
        driver.execute_script("arguments[0].click();", complete_btn)

        wait.until(EC.url_contains("/profile"))
        print("[PASS] Immediate resolution action navigated user directly to /profile.")

        # =====================================================================
        # PHASE 4: SELENIUM UI - EMPTY STATE FEEDBACK ACROSS ALL TABS
        # =====================================================================
        print("\n--- PHASE 4: SELENIUM UI - EMPTY STATE FEEDBACK ACROSS ALL TABS ---")
        driver.get(f"{FRONTEND_URL}/recommendations")
        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))

        search_input = wait.until(EC.presence_of_element_located((By.ID, "input-rec-search")))

        tab_scenarios = [
            ("tab-rec-supervisors", "no supervisor matches found"),
            ("tab-rec-teammates", "no complementary teammate matches found"),
            ("tab-rec-researchers", "no researcher matches found"),
            ("tab-rec-papers", "no publication matches found"),
            ("tab-rec-projects", "no open project matches found")
        ]

        for tab_id, expected_empty_msg in tab_scenarios:
            print(f"Testing search filter empty state on #{tab_id}...")
            tab_elem = wait.until(EC.element_to_be_clickable((By.ID, tab_id)))
            driver.execute_script("arguments[0].click();", tab_elem)
            time.sleep(0.4)

            # Enter impossible query
            set_react_input(driver, search_input, "synthetic_zero_match_query_99999")
            time.sleep(0.4)

            empty_elem = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "rec-empty-state")))
            assert expected_empty_msg in empty_elem.text.lower(), f"Expected '{expected_empty_msg}' in empty state, got: {empty_elem.text}"

            # Clear search
            set_react_input(driver, search_input, "")
            time.sleep(0.4)
            print(f"[PASS] Empty state validated on #{tab_id}: '{expected_empty_msg}'.")

        # Test Slider Filter Empty State on Supervisors
        print("Testing Slider Threshold Empty State on Supervisors Tab...")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-supervisors"))
        time.sleep(0.4)

        slider = driver.find_element(By.CLASS_NAME, "rec-slider")
        set_react_input(driver, slider, 90)
        time.sleep(0.4)

        slider_empty = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "rec-empty-state")))
        assert "no supervisor matches found" in slider_empty.text.lower()
        print("[PASS] Slider threshold empty state verified.")

        # Reset slider
        set_react_input(driver, slider, 0)
        time.sleep(0.4)

        # =====================================================================
        # PHASE 5: SELENIUM UI - SKILL GAP COLD START & BENCHMARK EVALUATION
        # =====================================================================
        print("\n--- PHASE 5: SELENIUM UI - SKILL GAP BENCHMARK EVALUATION ---")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-skillgap"))
        time.sleep(0.4)

        gap_custom_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".skillgap-custom-box input")))
        set_react_input(driver, gap_custom_input, "Non-Euclidean Computational Linguistics")

        analyze_btn = driver.find_element(By.CSS_SELECTOR, ".skillgap-custom-box button")
        driver.execute_script("arguments[0].click();", analyze_btn)
        time.sleep(1.2)

        skillgap_card = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "skillgap-card")))
        gap_card_text = skillgap_card.text.lower()
        assert "readiness score" in gap_card_text
        assert "high-yield missing skills" in gap_card_text
        assert "ai recommendation:" in gap_card_text
        print("[PASS] Skill gap domain analysis gracefully handled unrecognized domain with benchmark fallback.")

        # =====================================================================
        # PHASE 6: SELENIUM UI - COLD START TO WARM PROFILE ELEVATION
        # =====================================================================
        print("\n--- PHASE 6: SELENIUM UI - COLD START TO WARM PROFILE ELEVATION ---")

        # Check guidance banner still present on All Matches tab
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-all"))
        time.sleep(0.4)
        assert len(driver.find_elements(By.ID, "banner-profile-guidance")) > 0

        print(f"1. Elevating user #{cold_user['id']} profile from empty to fully specified...")
        enrich_res = requests.put(f"{BASE_API_URL}/profile", headers=cold_headers, json={
            "university": "MIT Artificial Intelligence Laboratory",
            "department": "Computer Science and AI",
            "interests": "Quantum Computing, Neural Algorithms, Distributed Consensus",
            "skills": "Python, Qiskit, Docker, PyTorch, C++",
            "bio": "Graduate researcher transitioning from cold start."
        })
        assert enrich_res.status_code == 200

        # Allow any prior toast from Phase 5 to dismiss
        time.sleep(2.0)

        print("2. Clicking 'Recalculate Matches' (#btn-rec-refresh) to refresh recommendations...")
        refresh_btn = driver.find_element(By.ID, "btn-rec-refresh")
        driver.execute_script("arguments[0].click();", refresh_btn)

        # Wait for refresh confirmation toast
        wait.until(lambda d: any(m in (d.find_element(By.ID, "rec-toast").text.lower() if len(d.find_elements(By.ID, "rec-toast")) > 0 else "") for m in ["re-indexed", "refreshed"]))
        print("[PASS] Re-indexing triggered and confirmed via refresh toast notice.")

        # 3. Assert Guidance Banner is now completely removed from the DOM
        wait.until(EC.invisibility_of_element_located((By.ID, "banner-profile-guidance")))
        banners = driver.find_elements(By.ID, "banner-profile-guidance")
        assert len(banners) == 0, "Profile completeness banner should disappear after enriching profile data!"
        print("[PASS] Profile completeness guidance banner successfully disappeared after profile completion.")

        # 4. Verify enriched match scores and personalized keywords
        print("3. Switching to Supervisors Tab to verify enriched match score...")
        driver.execute_script("arguments[0].click();", driver.find_element(By.ID, "tab-rec-supervisors"))
        time.sleep(0.6)

        sup_cards = driver.find_elements(By.CLASS_NAME, "supervisor-card")
        assert len(sup_cards) > 0, "No supervisor cards found after enrichment!"
        print(f"[PASS] Enriched recommendations active with {len(sup_cards)} supervisor cards.")

        print("\n==========================================================================================")
        print("=== ALL T-019.7 EMPTY-PROFILE & INSUFFICIENT DATA TESTS PASSED!                        ===")
        print("==========================================================================================")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_recommendation_empty_profile_insufficient_data()
