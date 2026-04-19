import os
import re

def extract_metadata(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Match YAML frontmatter between --- and ---
            match = re.search(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL | re.MULTILINE)
            if match:
                yaml_content = match.group(1)
                name_match = re.search(r'^name:\s*["\']?(.*?)["\']?\s*$', yaml_content, re.MULTILINE)
                desc_match = re.search(r'^description:\s*["\']?(.*?)["\']?\s*$', yaml_content, re.MULTILINE)
                
                # Handle multi-line descriptions if they exist (though usually they are single line or quoted)
                # For simplicity, we'll try to get the basic one first.
                
                name = name_match.group(1) if name_match else os.path.basename(os.path.dirname(file_path))
                description = desc_match.group(1) if desc_match else "No description found."
                
                return name, description
    except Exception as e:
        return None, str(e)
    return None, None

def main():
    base_dir = "claude-skills"
    skills = []
    for root, dirs, files in os.walk(base_dir):
        if "SKILL.md" in files:
            file_path = os.path.join(root, "SKILL.md")
            name, desc = extract_metadata(file_path)
            if name:
                skills.append((name, desc, file_path))
    
    # Sort by name
    skills.sort()
    
    for name, desc, path in skills:
        print(f"### {name}")
        print(f"**Description:** {desc}")
        print(f"*Path: {path}*")
        print("-" * 40)

if __name__ == "__main__":
    main()
