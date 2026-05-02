import os, glob, re

skills_dir = r'C:\Users\FGIAQUINTA\.gemini\skills'
project_dir = r'C:\Users\FGIAQUINTA\IdeaProjects\mi-despensa-familiar'
atl_dir = os.path.join(project_dir, '.atl')
os.makedirs(atl_dir, exist_ok=True)

user_skills = []
compact_rules = []

for f in glob.glob(os.path.join(skills_dir, '*', 'SKILL.md')):
    folder = os.path.basename(os.path.dirname(f))
    if folder.startswith('sdd-') or folder in ('_shared', 'skill-registry'):
        continue
        
    try:
        content = open(f, encoding='utf-8').read()
    except Exception:
        continue
    
    # Parse frontmatter
    name_m = re.search(r'^name:\s*([^\n]+)', content, re.MULTILINE)
    name = name_m.group(1).strip() if name_m else folder
    
    desc_m = re.search(r'^description:\s*>?(.*?)(?=\n[A-Za-z_-]+:|\n---)', content, re.DOTALL | re.MULTILINE)
    desc = desc_m.group(1).replace('\n', ' ') if desc_m else ''
    trigger_m = re.search(r'(?i)Trigger:\s*([^\.\n]+)', desc)
    trigger = trigger_m.group(1).strip() if trigger_m else 'No trigger defined'
    
    user_skills.append((trigger, name, f))
    
    # Extract rules
    rules_text = ''
    rules_match = re.search(r'(?i)##\s*(?:Compact\s*)?Rules\s*\n(.*?)(?=\n##\s|\Z)', content, re.DOTALL)
    if rules_match:
        rules_text = rules_match.group(1)
    else:
        rules_match = re.search(r'(?i)##\s*Critical Patterns.*?\n(.*?)(?=\n##\s|\Z)', content, re.DOTALL)
        if rules_match:
            rules_text = rules_match.group(1)
            
    if not rules_text.strip():
        # Just grab the first bullet points we can find
        rules_match = re.search(r'(?m)^[-*]\s+.+', content)
        if rules_match:
            lines = []
            for line in content[rules_match.start():].split('\n'):
                if line.strip().startswith('- ') or line.strip().startswith('* '):
                    lines.append(line.strip())
                elif not line.strip():
                    continue
                else:
                    break
            rules_text = '\n'.join(lines)
            
    if not rules_text.strip():
        rules_text = "- No explicit rules found in SKILL.md. Agent must use best judgement."

    # Filter to 15 lines max, removing empty lines and markdown fluff
    clean_lines = [l.strip() for l in rules_text.split('\n') if l.strip() and not l.startswith('```')]
    rules_text = '\n'.join(clean_lines[:15])
    compact_rules.append((name, rules_text))

# Write markdown
md = []
md.append("# Skill Registry")
md.append("")
md.append("**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.")
md.append("")
md.append("See `_shared/skill-resolver.md` for the full resolution protocol.")
md.append("")

md.append("## User Skills")
md.append("")
md.append("| Trigger | Skill | Path |")
md.append("|---------|-------|------|")
for trigger, name, f in sorted(user_skills, key=lambda x: x[1]):
    md.append(f"| {trigger} | {name} | {f} |")

md.append("")
md.append("## Compact Rules")
md.append("")
md.append("Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.")
md.append("")

for name, rules in sorted(compact_rules, key=lambda x: x[0]):
    md.append(f"### {name}")
    for line in rules.split('\n'):
        if not line.startswith('-') and not line.startswith('*'):
            md.append(f"- {line}")
        else:
            md.append(line)
    md.append("")

md.append("## Project Conventions")
md.append("")
md.append("| File | Path | Notes |")
md.append("|------|------|-------|")
md.append(f"| AGENTS.md | {os.path.join(project_dir, 'AGENTS.md')} | Standalone file |")
md.append(f"| CLAUDE.md | {os.path.join(project_dir, 'CLAUDE.md')} | Index — references files below |")
md.append(f"| AGENTS.md | {os.path.join(project_dir, 'AGENTS.md')} | Referenced by CLAUDE.md |")
md.append(f"| GEMINI.md | {os.path.join(project_dir, 'GEMINI.md')} | Standalone file |")
md.append("")
md.append("Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.")

output_file = os.path.join(atl_dir, 'skill-registry.md')
with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(md))
