import os
import shutil
import sys
import subprocess

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.engine.authorship import AuthorshipTracker


def test_authorship_tracker():
    test_dir = "/tmp/test_authorship_project"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)

    # Tạo dự án git giả với commit cũ hơn cửa sổ recent mặc định và commit mới
    subprocess.run(["git", "init"], cwd=test_dir, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "TestUser"], cwd=test_dir, check=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"], cwd=test_dir, check=True
    )

    file_path = os.path.join(test_dir, "main.py")
    with open(file_path, "w") as f:
        f.write("def old_hello():\n    print('hello 1 year ago')\n")

    subprocess.run(["git", "add", "main.py"], cwd=test_dir, check=True)
    # Commit 1 year ago
    subprocess.run(
        ["git", "commit", "-m", "Old commit", '--date="1 year ago"'],
        cwd=test_dir,
        check=True,
    )

    with open(file_path, "a") as f:
        f.write("def new_hello():\n    print('hello today')\n")

    subprocess.run(["git", "add", "main.py"], cwd=test_dir, check=True)
    # Commit today
    subprocess.run(["git", "commit", "-m", "New commit"], cwd=test_dir, check=True)

    tracker = AuthorshipTracker(test_dir)
    # Truy vấn line 1 (commit 1 năm trước, sẽ bị đánh dấu boundary)
    info1 = tracker.get_author_info("main.py", 1)
    print("Line 1:", info1)
    assert (
        info1["boundary"] == True
    ), "Dòng 1 phải nằm ngoài cửa sổ recent mặc định (boundary=True)"

    # Truy vấn line 3 (commit hôm nay, boundary = False)
    info3 = tracker.get_author_info("main.py", 3)
    print("Line 3:", info3)
    assert (
        info3["boundary"] == False
    ), "Dòng 3 phải nằm trong cửa sổ recent mặc định (boundary=False)"
    assert info3["author"] == "TestUser", "Dòng 3 phải thuộc về TestUser"

    # Kiểm tra LOC
    locs = tracker.get_all_member_loc()
    print("Membet LOC:", locs)
    assert locs.get("test@example.com", 0) == 2, "TestUser phải có 2 dòng (line 3, 4)"

    print("PASS: AuthorshipTracker hoạt động chuẩn xác.")


if __name__ == "__main__":
    try:
        test_authorship_tracker()
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
