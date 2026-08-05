import os
import re

docs_dir = r"c:\Users\jlja\Documents\newLabSOM\docs"

def fix_math_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace inline $$ formula $$ with ```math \n formula \n ```
    # Using a regex that captures everything between $$ and $$
    # Ensure it handles single lines since they are all currently single line
    
    # Regex explanation:
    # \$\$\s*(.*?)\s*\$\$
    # Matches $$ followed by optional spaces, then the formula, then optional spaces, then $$
    
    fixed_content = re.sub(
        r'\$\$\s*(.*?)\s*\$\$',
        r'```math\n\1\n```',
        content,
        flags=re.DOTALL
    )
    
    if content != fixed_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Fixed math in {filepath}")

for filename in os.listdir(docs_dir):
    if filename.endswith(".md"):
        fix_math_in_file(os.path.join(docs_dir, filename))

print("Math fix complete.")
