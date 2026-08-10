import subprocess
import sys

# List of scripts to execute in sequential order
scripts = [
    "generate_listings.py",
    "generate_listings_csv.py",
    "generate_picture_mappings.py",
]

def run_scripts():
    for script in scripts:
        print(f"Executing {script}...")
        try:
            # sys.executable ensures the script runs using the same Python interpreter
            subprocess.run([sys.executable, script], check=True)
            print(f"Successfully finished {script}.\n")
        except subprocess.CalledProcessError as e:
            print(f"Error executing {script}: Exited with status code {e.returncode}")
            sys.exit(e.returncode)

if __name__ == "__main__":
    run_scripts()