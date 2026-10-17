"""
test_chat_permissions_unread_integration.py
============================================
Automated Selenium & API Integration Test Suite for:
[T-025.6] Test chat access permissions, unread/read states, and integration

Features Tested:
1. Access Permissions & Security Boundaries:
   - 401 Unauthorized for unauthenticated requests to chat endpoints
   - 403 Forbidden for non-participants attempting to view conversations, fetch messages, post messages, mark as read, or view unread counts
   - 403 Forbidden for non-members attempting to add participants or modify team chats
   - 400 Bad Request enforcement on invalid actions (self-chat, adding participant to direct chat, duplicate participant addition)
2. Unread / Read State Transitions (API & Real-Time Sync):
   - Message dispatch increases recipient unread count (both total and per-conversation)
   - Sender unread count remains 0
   - Multi-conversation unread accumulation across Direct and Team channels
   - Read endpoint (POST /api/chat/conversations/{id}/read) resets conversation unread count and decreases total unread count
3. UI & Dual-Browser Integration:
   - Sidebar unread indicator (#badge-sidebar-unread-messages) reflects unread messages when user is on other routes (e.g. /home)
   - /messages header displays total unread badge (#badge-total-unread)
   - Conversation list displays per-conversation unread pill (#unread-badge-{id}) and unread preview styling
   - Selecting / opening the conversation immediately triggers markAsRead, clearing unread badges in the UI and backend
   - Non-participant user isolation: unauthorized conversations are never listed in the UI or accessible via DOM/API injection
"""

import os
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"


def register_user(role, full_name, email, password):
    res = requests.post(f"{BASE_API_URL}/auth/register", json={
        "email": email,
        "password": password,
        "fullName": full_name,
        "role": role
    })
    assert res.status_code in [200, 201], f"Registration failed: {res.text}"
    token = res.json().get("token")
    user_id = res.json().get("user", {}).get("id")

    # Set profile to ensure discoverable
    headers = {"Authorization": f"Bearer {token}"}
    requests.post(f"{BASE_API_URL}/profile", headers=headers, json={
        "institution": "Stanford University",
        "department": "Computer Science",
        "designation": role,
        "bio": f"Profile for {full_name}",
        "researchInterests": "Distributed Systems, AI Safety, Quantum Computing",
        "skills": "Python, C#, Distributed Systems",
        "isAvailableForCollaboration": True,
        "visibility": "Public"
    })

    return {
        "id": user_id,
        "email": email,
        "password": password,
        "fullName": full_name,
        "token": token
    }


def create_driver():
    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    driver = webdriver.Chrome(options=options)
    return driver


def test_chat_permissions_unread_and_integration():
    print("==========================================================================================")
    print("=== STARTING T-025.6: CHAT ACCESS PERMISSIONS, UNREAD/READ STATES & INTEGRATION TEST ===")
    print("==========================================================================================")

    timestamp = int(time.time() * 1000)

    # 0. Set up test users: Alice (Faculty), Bob (Student), Charlie (External Peer)
    print("0. Registering test users (Alice, Bob, Charlie)...")
    alice = register_user("Faculty", f"Dr. Alice Lovelace {timestamp}", f"alice_perm_{timestamp}@perimtest.com", "Password123!")
    bob = register_user("Student", f"Bob Turing {timestamp}", f"bob_perm_{timestamp}@perimtest.com", "Password123!")
    charlie = register_user("Collaborator", f"Charlie Shannon {timestamp}", f"charlie_perm_{timestamp}@perimtest.com", "Password123!")

    headers_alice = {"Authorization": f"Bearer {alice['token']}"}
    headers_bob = {"Authorization": f"Bearer {bob['token']}"}
    headers_charlie = {"Authorization": f"Bearer {charlie['token']}"}

    # =========================================================================
    # PHASE 1: API ACCESS PERMISSIONS & SECURITY BOUNDARIES
    # =========================================================================
    print("\n--- PHASE 1: API ACCESS PERMISSIONS & SECURITY BOUNDARIES ---")

    # 1. Unauthenticated rejection (401 Unauthorized)
    print("1. Validating 401 Unauthorized on unauthenticated chat endpoints...")
    r_no_auth_convs = requests.get(f"{BASE_API_URL}/chat/conversations")
    assert r_no_auth_convs.status_code == 401, f"Expected 401, got {r_no_auth_convs.status_code}"

    r_no_auth_unread = requests.get(f"{BASE_API_URL}/chat/unread-count")
    assert r_no_auth_unread.status_code == 401, f"Expected 401, got {r_no_auth_unread.status_code}"

    r_no_auth_read = requests.post(f"{BASE_API_URL}/chat/conversations/1/read")
    assert r_no_auth_read.status_code == 401, f"Expected 401, got {r_no_auth_read.status_code}"

    r_no_auth_msgs = requests.get(f"{BASE_API_URL}/chat/conversations/1/messages")
    assert r_no_auth_msgs.status_code == 401, f"Expected 401, got {r_no_auth_msgs.status_code}"

    r_no_auth_post = requests.post(f"{BASE_API_URL}/chat/conversations/1/messages", json={"content": "hello"})
    assert r_no_auth_post.status_code == 401, f"Expected 401, got {r_no_auth_post.status_code}"
    print("[PASS] 401 Unauthorized enforced for all unauthenticated chat operations.")

    # 2. Self-chat constraint (400 Bad Request)
    print("2. Validating self-chat restriction (400 Bad Request)...")
    r_self = requests.post(f"{BASE_API_URL}/chat/conversations/direct", headers=headers_alice, json={"targetUserId": alice["id"]})
    assert r_self.status_code == 400, f"Expected 400 for self chat, got: {r_self.status_code}"
    print("[PASS] Self-chat blocked with 400 Bad Request.")

    # 3. Create Direct conversation between Alice and Bob
    print("3. Creating direct conversation between Alice and Bob...")
    r_direct = requests.post(f"{BASE_API_URL}/chat/conversations/direct", headers=headers_alice, json={"targetUserId": bob["id"]})
    assert r_direct.status_code in [200, 201], f"Failed to create direct conv: {r_direct.text}"
    conv_ab_id = r_direct.json()["id"]
    print(f"[PASS] Direct conversation #{conv_ab_id} established between Alice and Bob.")

    # 4. Forbidden access checks for Charlie (non-participant in conv_ab)
    print(f"4. Validating Charlie (non-participant) receives 403 Forbidden on conversation #{conv_ab_id}...")
    r_charlie_msgs = requests.get(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/messages", headers=headers_charlie)
    assert r_charlie_msgs.status_code == 403, f"Expected 403 for messages GET, got: {r_charlie_msgs.status_code}"

    r_charlie_post = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/messages", headers=headers_charlie, json={"content": "Unauthorized intrusion"})
    assert r_charlie_post.status_code == 403, f"Expected 403 for messages POST, got: {r_charlie_post.status_code}"

    r_charlie_read = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/read", headers=headers_charlie)
    assert r_charlie_read.status_code == 403, f"Expected 403 for read POST, got: {r_charlie_read.status_code}"

    r_charlie_unread = requests.get(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/unread-count", headers=headers_charlie)
    assert r_charlie_unread.status_code == 403, f"Expected 403 for unread GET, got: {r_charlie_unread.status_code}"

    r_charlie_arch = requests.patch(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/archive", headers=headers_charlie)
    assert r_charlie_arch.status_code == 403, f"Expected 403 for archive PATCH, got: {r_charlie_arch.status_code}"
    print("[PASS] Non-participant strictly denied (403 Forbidden) from viewing, posting, reading, or archiving.")

    # 5. Direct conversation participant modification restriction (400 Bad Request)
    print("5. Validating participant modification rejection on Direct conversation...")
    r_add_to_direct = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/participants", headers=headers_alice, json={"newUserId": charlie["id"]})
    assert r_add_to_direct.status_code == 400, f"Expected 400 for adding participant to Direct conv, got: {r_add_to_direct.status_code}"
    print("[PASS] Adding participants to Direct conversation rejected with 400 Bad Request.")

    # 6. Team conversation creation & duplicate participant check
    print("6. Creating Team conversation between Alice and Bob, testing duplicate participant...")
    r_team = requests.post(f"{BASE_API_URL}/chat/conversations/team", headers=headers_alice, json={
        "name": f"Perm Research Sync {timestamp}",
        "participantIds": [bob["id"]]
    })
    assert r_team.status_code in [200, 201], f"Failed to create team conv: {r_team.text}"
    conv_team_id = r_team.json()["id"]

    # Attempt to add Bob again
    r_dup_participant = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_team_id}/participants", headers=headers_alice, json={"newUserId": bob["id"]})
    assert r_dup_participant.status_code == 400, f"Expected 400 for duplicate participant, got: {r_dup_participant.status_code}"

    # Non-member (Charlie) attempts to add participant to team chat
    r_charlie_add = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_team_id}/participants", headers=headers_charlie, json={"newUserId": charlie["id"]})
    assert r_charlie_add.status_code == 403, f"Expected 403 when non-member adds participant, got: {r_charlie_add.status_code}"
    print(f"[PASS] Team conversation #{conv_team_id} participant validation and non-member isolation verified.")

    # =========================================================================
    # PHASE 2: UNREAD / READ STATE TRANSITIONS VIA API
    # =========================================================================
    print("\n--- PHASE 2: UNREAD / READ STATE TRANSITIONS VIA API ---")

    # 1. Initial unread counts must be 0
    print("1. Checking initial unread states...")
    unread_bob_init = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_bob).json().get("unreadCount", 0)
    assert unread_bob_init == 0, f"Expected initial unread 0, got {unread_bob_init}"

    # 2. Alice sends 2 messages in conv_ab
    print(f"2. Alice sending 2 messages in direct conversation #{conv_ab_id}...")
    requests.post(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/messages", headers=headers_alice, json={"content": "Direct msg 1"})
    requests.post(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/messages", headers=headers_alice, json={"content": "Direct msg 2"})

    # Check Bob's unread counts
    unread_bob_total = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_bob).json().get("unreadCount")
    unread_bob_conv = requests.get(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/unread-count", headers=headers_bob).json().get("unreadCount")
    assert unread_bob_total == 2, f"Expected Bob total unread 2, got {unread_bob_total}"
    assert unread_bob_conv == 2, f"Expected Bob conv #{conv_ab_id} unread 2, got {unread_bob_conv}"

    # Check Alice's unread count (sender should remain 0)
    unread_alice_total = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_alice).json().get("unreadCount")
    assert unread_alice_total == 0, f"Expected sender Alice unread 0, got {unread_alice_total}"
    print(f"[PASS] Message dispatch properly incremented Bob's unread counts to 2, Alice remains 0.")

    # 3. Alice sends 1 message in conv_team
    print(f"3. Alice sending 1 message in team conversation #{conv_team_id}...")
    requests.post(f"{BASE_API_URL}/chat/conversations/{conv_team_id}/messages", headers=headers_alice, json={"content": "Team sync message"})

    unread_bob_total2 = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_bob).json().get("unreadCount")
    unread_bob_team = requests.get(f"{BASE_API_URL}/chat/conversations/{conv_team_id}/unread-count", headers=headers_bob).json().get("unreadCount")
    assert unread_bob_total2 == 3, f"Expected Bob total unread 3 (2 direct + 1 team), got {unread_bob_total2}"
    assert unread_bob_team == 1, f"Expected Bob team conv unread 1, got {unread_bob_team}"
    print(f"[PASS] Multi-conversation unread accumulation verified: 2 direct + 1 team = {unread_bob_total2} total.")

    # 4. Bob reads conv_team -> resets team unread to 0, total drops to 2
    print(f"4. Bob reading team conversation #{conv_team_id}...")
    r_read_team = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_team_id}/read", headers=headers_bob)
    assert r_read_team.status_code == 200, f"Failed to mark team conv read: {r_read_team.text}"

    unread_bob_team_after = requests.get(f"{BASE_API_URL}/chat/conversations/{conv_team_id}/unread-count", headers=headers_bob).json().get("unreadCount")
    unread_bob_total3 = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_bob).json().get("unreadCount")
    assert unread_bob_team_after == 0, f"Expected team conv unread 0, got {unread_bob_team_after}"
    assert unread_bob_total3 == 2, f"Expected Bob total unread 2 after reading team conv, got {unread_bob_total3}"
    print(f"[PASS] Team conversation marked as read: team unread reset to 0, total unread decremented to 2.")

    # 5. Bob reads conv_ab -> resets direct unread to 0, total drops to 0
    print(f"5. Bob reading direct conversation #{conv_ab_id}...")
    r_read_direct = requests.post(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/read", headers=headers_bob)
    assert r_read_direct.status_code == 200, f"Failed to mark direct conv read: {r_read_direct.text}"

    unread_bob_direct_after = requests.get(f"{BASE_API_URL}/chat/conversations/{conv_ab_id}/unread-count", headers=headers_bob).json().get("unreadCount")
    unread_bob_total4 = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_bob).json().get("unreadCount")
    assert unread_bob_direct_after == 0, f"Expected direct conv unread 0, got {unread_bob_direct_after}"
    assert unread_bob_total4 == 0, f"Expected total unread 0, got {unread_bob_total4}"
    print(f"[PASS] Direct conversation marked as read: all unread counts returned cleanly to 0.")

    # =========================================================================
    # PHASE 3: DUAL-BROWSER UI INTEGRATION & UNREAD BADGE TRANSITIONS
    # =========================================================================
    print("\n--- PHASE 3: DUAL-BROWSER UI INTEGRATION & UNREAD BADGE TRANSITIONS ---")

    driver_alice = create_driver()
    driver_bob = create_driver()
    wait_alice = WebDriverWait(driver_alice, 15)
    wait_bob = WebDriverWait(driver_bob, 15)

    try:
        # 1. Login Alice in Browser 1
        print("1. Logging in Alice in Browser 1...")
        driver_alice.get(f"{FRONTEND_URL}/login")
        in_email_a = wait_alice.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_a.clear()
        in_email_a.send_keys(alice["email"])
        driver_alice.find_element(By.XPATH, "//input[@type='password']").send_keys(alice["password"])
        driver_alice.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_alice.until(EC.url_contains("/profile"))
        print("[PASS] Alice logged in.")

        # 2. Login Bob in Browser 2 and place him on /home (not /messages)
        print("2. Logging in Bob in Browser 2 and navigating to /home...")
        driver_bob.get(f"{FRONTEND_URL}/login")
        in_email_b = wait_bob.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_b.clear()
        in_email_b.send_keys(bob["email"])
        driver_bob.find_element(By.XPATH, "//input[@type='password']").send_keys(bob["password"])
        driver_bob.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_bob.until(EC.url_contains("/profile"))

        driver_bob.get(f"{FRONTEND_URL}/search")
        wait_bob.until(EC.presence_of_element_located((By.CLASS_NAME, "sidebar")))
        print("[PASS] Bob logged in and viewing /search.")

        # Verify Bob does NOT have an unread messages badge on sidebar initially
        sidebar_badges = driver_bob.find_elements(By.ID, "badge-sidebar-unread-messages")
        assert len(sidebar_badges) == 0 or sidebar_badges[0].text.strip() in ["", "0"], "Expected no initial sidebar unread badge"
        print("[PASS] Bob initially has no sidebar unread messages badge.")

        # 3. Alice navigates to /messages, opens conv_ab
        print("3. Alice opening /messages...")
        driver_alice.get(f"{FRONTEND_URL}/messages")
        wait_alice.until(EC.presence_of_element_located((By.ID, "chat-page-container")))

        # Wait for conv_ab item to appear in Alice's list and click it
        conv_ab_item_a = wait_alice.until(EC.presence_of_element_located((By.ID, f"conv-item-{conv_ab_id}")))
        driver_alice.execute_script("arguments[0].click();", conv_ab_item_a)
        wait_alice.until(EC.presence_of_element_located((By.ID, "input-chat-message")))

        # 4. Alice sends 2 new real-time messages to Bob
        live_msg_1 = f"Realtime Note A {timestamp}"
        live_msg_2 = f"Realtime Note B {timestamp}"
        print(f"4. Alice sending 2 real-time messages to Bob in conv #{conv_ab_id}...")

        def has_bubble(drv, text):
            return drv.execute_script(
                "return Array.from(document.querySelectorAll('.msg-bubble')).some(b => (b.textContent || '').includes(arguments[0]))",
                text
            )

        in_msg_alice = wait_alice.until(EC.presence_of_element_located((By.ID, "input-chat-message")))
        in_msg_alice.clear()
        in_msg_alice.send_keys(live_msg_1)
        time.sleep(0.3)
        btn_send_1 = wait_alice.until(EC.element_to_be_clickable((By.ID, "btn-send-message")))
        driver_alice.execute_script("arguments[0].click();", btn_send_1)
        wait_alice.until(lambda d: has_bubble(d, live_msg_1))

        in_msg_alice = wait_alice.until(EC.presence_of_element_located((By.ID, "input-chat-message")))
        in_msg_alice.clear()
        in_msg_alice.send_keys(live_msg_2)
        time.sleep(0.3)
        btn_send_2 = wait_alice.until(EC.element_to_be_clickable((By.ID, "btn-send-message")))
        driver_alice.execute_script("arguments[0].click();", btn_send_2)
        wait_alice.until(lambda d: has_bubble(d, live_msg_2))
        print("[PASS] Both messages sent and visible in Alice's viewport.")

        # 5. Check Bob's Sidebar badge (#badge-sidebar-unread-messages)
        print("5. Bob refreshing / navigating to trigger unread check on sidebar...")
        # Trigger fetchUnread in Sidebar by navigating to /search
        driver_bob.get(f"{FRONTEND_URL}/search")
        badge_sidebar = wait_bob.until(EC.presence_of_element_located((By.ID, "badge-sidebar-unread-messages")))
        wait_bob.until(lambda d: (d.find_element(By.ID, "badge-sidebar-unread-messages").get_attribute("textContent") or "").strip() == "2")
        sidebar_val = (badge_sidebar.get_attribute("textContent") or badge_sidebar.text).strip()
        assert sidebar_val == "2", f"Expected sidebar unread badge '2', got '{sidebar_val}'"
        print(f"[PASS] Bob's sidebar displays unread messages badge with count '{sidebar_val}'.")

        # 6. Bob navigates to /messages
        print("6. Bob clicking Messages in sidebar to navigate to /messages...")
        link_messages = wait_bob.until(EC.presence_of_element_located((By.XPATH, "//a[@href='/messages']")))
        driver_bob.execute_script("arguments[0].click();", link_messages)
        wait_bob.until(EC.presence_of_element_located((By.ID, "chat-page-container")))

        # Verify Header Total Unread Badge (#badge-total-unread)
        badge_total = wait_bob.until(EC.presence_of_element_located((By.ID, "badge-total-unread")))
        wait_bob.until(lambda d: (d.find_element(By.ID, "badge-total-unread").get_attribute("textContent") or "").strip() == "2")
        total_val = (badge_total.get_attribute("textContent") or badge_total.text).strip()
        assert total_val == "2", f"Expected header total unread '2', got '{total_val}'"
        print(f"[PASS] /messages header total unread badge displays '{total_val}'.")

        # Verify per-conversation unread pill (#unread-badge-{conv_ab_id})
        badge_conv = wait_bob.until(EC.presence_of_element_located((By.ID, f"unread-badge-{conv_ab_id}")))
        wait_bob.until(lambda d: (d.find_element(By.ID, f"unread-badge-{conv_ab_id}").get_attribute("textContent") or "").strip() == "2")
        conv_val = (badge_conv.get_attribute("textContent") or badge_conv.text).strip()
        assert conv_val == "2", f"Expected conv #{conv_ab_id} unread pill '2', got '{conv_val}'"
        print(f"[PASS] Conversation #{conv_ab_id} item unread pill displays '{conv_val}'.")

        # Verify last message unread styling on conv-last-msg
        conv_item_b = driver_bob.find_element(By.ID, f"conv-item-{conv_ab_id}")
        last_msg_el = conv_item_b.find_element(By.CLASS_NAME, "conv-last-msg")
        assert "unread" in last_msg_el.get_attribute("className"), "Expected conv-last-msg to have 'unread' class"
        print("[PASS] Conversation preview has active 'unread' styling.")

        # 7. Bob clicks on the conversation to read it
        print(f"7. Bob clicking on conversation #{conv_ab_id} to read messages...")
        driver_bob.execute_script("arguments[0].click();", conv_item_b)

        # Verify conversation messages load
        wait_bob.until(lambda d: d.execute_script(
            "return Array.from(document.querySelectorAll('.msg-bubble')).some(e => (e.textContent || '').includes(arguments[0]));",
            live_msg_2
        ))
        print("[PASS] Messages rendered in Bob's viewport.")

        # Verify unread pill disappears for conv_ab
        wait_bob.until(lambda d: len(d.find_elements(By.ID, f"unread-badge-{conv_ab_id}")) == 0)
        print("[PASS] Conversation unread badge automatically cleared on read.")

        # Verify total unread badge disappears or becomes 0
        wait_bob.until(lambda d: len(d.find_elements(By.ID, "badge-total-unread")) == 0 or (d.find_element(By.ID, "badge-total-unread").get_attribute("textContent") or "").strip() in ["", "0"])
        print("[PASS] Header total unread badge automatically cleared.")

        # Verify conv-last-msg no longer has 'unread' class
        wait_bob.until(lambda d: "unread" not in d.find_element(By.ID, f"conv-item-{conv_ab_id}").find_element(By.CLASS_NAME, "conv-last-msg").get_attribute("className"))
        print("[PASS] Conversation preview 'unread' class removed.")

        # Verify backend API unread count is 0
        time.sleep(0.5)
        unread_bob_api = requests.get(f"{BASE_API_URL}/chat/unread-count", headers=headers_bob).json().get("unreadCount")
        assert unread_bob_api == 0, f"Expected backend unread 0 after UI read, got {unread_bob_api}"
        print("[PASS] Backend API confirmed unread count is 0.")

        # 8. Bob navigates back to /search and verifies sidebar badge is gone
        print("8. Bob navigating back to /search to confirm sidebar unread badge is cleared...")
        driver_bob.get(f"{FRONTEND_URL}/search")
        wait_bob.until(EC.presence_of_element_located((By.CLASS_NAME, "sidebar")))
        time.sleep(1.0)
        sidebar_badges_after = driver_bob.find_elements(By.ID, "badge-sidebar-unread-messages")
        assert len(sidebar_badges_after) == 0 or (sidebar_badges_after[0].get_attribute("textContent") or "").strip() in ["", "0"], "Expected sidebar badge removed"
        print("[PASS] Sidebar unread badge cleared on /search.")

        # =====================================================================
        # PHASE 4: CROSS-USER PRIVACY & INTEGRATION ISOLATION IN UI
        # =====================================================================
        print("\n--- PHASE 4: CROSS-USER PRIVACY & ISOLATION IN UI ---")

        # 1. Log out Bob and log in Charlie in Browser 2
        print(f"1. Logging in Charlie ('{charlie['email']}') in Browser 2...")
        driver_bob.get(f"{FRONTEND_URL}/login")
        in_email_c = wait_bob.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_c.clear()
        in_email_c.send_keys(charlie["email"])
        driver_bob.find_element(By.XPATH, "//input[@type='password']").send_keys(charlie["password"])
        driver_bob.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_bob.until(EC.url_contains("/profile"))

        # Navigate Charlie to /messages
        driver_bob.get(f"{FRONTEND_URL}/messages")
        wait_bob.until(EC.presence_of_element_located((By.ID, "chat-page-container")))
        time.sleep(1.5)

        # 2. Verify Alice-Bob direct conversation is NOT in Charlie's conversation list
        print(f"2. Verifying Alice-Bob direct conversation #{conv_ab_id} is hidden from Charlie's list...")
        charlie_conv_items = driver_bob.find_elements(By.ID, f"conv-item-{conv_ab_id}")
        assert len(charlie_conv_items) == 0, f"Security Breach! Charlie sees conversation #{conv_ab_id} in UI list"
        print(f"[PASS] Privacy confirmed: Conversation #{conv_ab_id} is strictly absent from Charlie's UI.")

        # 3. Verify Charlie cannot fetch conv_ab messages via JavaScript injection
        print(f"3. Verifying Charlie cannot fetch messages from conv #{conv_ab_id} via in-browser API...")
        js_fetch_status = driver_bob.execute_async_script("""
            const convId = arguments[0];
            const done = arguments[arguments.length - 1];
            const token = localStorage.getItem('token');
            fetch('http://localhost:5000/api/chat/conversations/' + convId + '/messages', {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(r => done(r.status)).catch(e => done(-1));
        """, conv_ab_id)
        assert js_fetch_status == 403, f"Expected 403 Forbidden for Charlie's JS fetch, got {js_fetch_status}"
        print(f"[PASS] In-browser security boundary confirmed: JS fetch returned status {js_fetch_status} Forbidden.")

        # 4. Alice sends another message to Bob while Charlie is active in /messages
        print(f"4. Alice sending private message to Bob; verifying Charlie's session remains untouched...")
        in_msg_alice = wait_alice.until(EC.presence_of_element_located((By.ID, "input-chat-message")))
        in_msg_alice.clear()
        in_msg_alice.send_keys(f"Confidential PI data {timestamp}")
        driver_alice.find_element(By.ID, "btn-send-message").click()
        time.sleep(1.5)

        # Charlie should receive no unread badges
        charlie_total_unread = driver_bob.find_elements(By.ID, "badge-total-unread")
        assert len(charlie_total_unread) == 0 or (charlie_total_unread[0].get_attribute("textContent") or "").strip() in ["", "0"], "Security Breach! Charlie received unread badge for another user's conversation"
        print("[PASS] Cross-user isolation confirmed: Charlie received 0 unread alerts for Alice-Bob communication.")

    finally:
        print("\nCleaning up browser sessions...")
        driver_alice.quit()
        driver_bob.quit()

    print("\n==========================================================================================")
    print("=== T-025.6: CHAT PERMISSIONS, UNREAD/READ STATES & INTEGRATION TEST PASSED SUCCESSFULLY ===")
    print("==========================================================================================")


if __name__ == "__main__":
    test_chat_permissions_unread_and_integration()
