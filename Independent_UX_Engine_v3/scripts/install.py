#!/usr/bin/env python3
"""Safe local installer for UX Engine. Python 3.9+ stdlib only."""
import argparse, pathlib, shutil, sys, json
ROOT=pathlib.Path(__file__).resolve().parents[1]
SKILLS=sorted((ROOT/'skills').iterdir())
COMMANDS=sorted((ROOT/'commands').glob('*.md'))

def install(project, platform, dry_run=False, force=False):
    project=pathlib.Path(project).expanduser().resolve()
    if not project.is_dir(): raise ValueError('Target project directory does not exist')
    if platform=='claude':
        skill_base=project/'.claude'/'skills'; cmd_base=project/'.claude'/'commands'; agent_base=project/'.claude'/'agents'
    elif platform=='opencode':
        skill_base=project/'.opencode'/'skills'; cmd_base=project/'.opencode'/'commands'; agent_base=project/'.opencode'/'agents'
    elif platform=='codex':
        skill_base=project/'.agents'/'skills'; cmd_base=None; agent_base=None
    else: raise ValueError('Unsupported platform')
    actions=[]
    for d in SKILLS: actions.append((d,skill_base/d.name,True))
    if cmd_base:
        for p in COMMANDS: actions.append((p,cmd_base/p.name,False))
    if agent_base:
        for p in sorted((ROOT/'agents').glob('*.md')): actions.append((p,agent_base/p.name,False))
    # For Codex, provide discoverable command skills rather than promising native slash commands.
    if platform=='codex':
        for p in COMMANDS: actions.append((p,skill_base/('workflow-'+p.stem)/'SKILL.md',False))
    conflicts=[str(dst) for _,dst,_ in actions if dst.exists()]
    if conflicts and not force:
        print(json.dumps({'status':'conflict','files':conflicts,'hint':'Use a clean project, or --force after reviewing backups'},indent=2)); return 2
    for source,dest,is_dir in actions:
        print(('PLAN' if dry_run else 'INSTALL'),str(dest))
        if dry_run:continue
        dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.exists():
            backup=dest.with_name(dest.name+'.ux-backup')
            if backup.exists(): raise RuntimeError('Backup exists; refusing to overwrite: '+str(backup))
            dest.rename(backup)
        if is_dir:shutil.copytree(source,dest)
        else:
            data=source.read_text(encoding='utf-8')
            if platform=='codex':
                title=source.stem
                data='---\nname: workflow-'+title+'\ndescription: UX workflow for '+title+'; invoke by requesting this skill.\n---\n'+data
            dest.write_text(data,encoding='utf-8')
    print('Installed',len(actions),'entries; existing project AGENTS.md and DESIGN.md unchanged.')
    if platform=='codex':print('Codex: invoke workflow-* skills in natural language; native slash command registration not claimed.')
    return 0

def main():
    p=argparse.ArgumentParser();p.add_argument('--project',required=True);p.add_argument('--platform',choices=['claude','codex','opencode'],required=True);p.add_argument('--dry-run',action='store_true');p.add_argument('--force',action='store_true');a=p.parse_args()
    try:sys.exit(install(a.project,a.platform,a.dry_run,a.force))
    except (ValueError,RuntimeError) as e:print('ERROR:',e,file=sys.stderr);sys.exit(1)
if __name__=='__main__':main()
