"""Public, read-only HTTP evidence for Hostinger support. No credentials used."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import urllib.parse

out = Path('reports/hostinger-support')
out.mkdir(parents=True, exist_ok=True)

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

network = {
    'description': 'GitHub-hosted ubuntu-latest runner; not a mobile hotspot',
    'run_id': os.getenv('GITHUB_RUN_ID'),
    'run_attempt': os.getenv('GITHUB_RUN_ATTEMPT'),
    'runner_os': os.getenv('RUNNER_OS'),
    'utc_start': utc(),
}
(out / 'network.json').write_text(json.dumps(network, indent=2))
results = []
agents = {
    'lighthouse': 'Chrome-Lighthouse',
    'browser': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
}
unique = 'audit=' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + os.getenv('GITHUB_RUN_ID', 'local')
for host in ['salespunch360.com', 'www.salespunch360.com']:
    for query in ['', '?' + unique]:
        url = 'https://' + host + '/' + query
        for name, agent in agents.items():
            for method in ['HEAD', 'GET']:
                label = f'{host}-{name}-{method}-' + ('unique' if query else 'root')
                command = ['curl', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', '--location', '--max-redirs', '5', '--include', '--user-agent', agent]
                if method == 'HEAD':
                    command += ['--head']
                command += ['--output', str(out / (label + '.response.txt')), '--write-out', '%{json}', url]
                start = utc()
                run = subprocess.run(command, capture_output=True, text=True)
                (out / (label + '.stderr.txt')).write_text(run.stderr)
                try:
                    transport = json.loads(run.stdout)
                    # Avoid environment-specific proxy URLs; keep public HTTP transport fields.
                    transport = {key: transport.get(key) for key in ['http_code', 'url_effective', 'remote_ip', 'remote_port', 'http_version', 'num_redirects', 'time_total', 'errormsg']}
                except json.JSONDecodeError:
                    transport = {'metadata_parse_error': True}
                record = {'name': label, 'utc_start': start, 'utc_end': utc(), 'method': method, 'url': url, 'user_agent': agent, 'exit_code': run.returncode, 'transport': transport}
                results.append(record)
                (out / (label + '.metadata.json')).write_text(json.dumps(record, indent=2))
                print(json.dumps(record), flush=True)
# Request Google's own PageSpeed Insights service against a unique URL.
for strategy in ['mobile', 'desktop']:
    target = 'https://www.salespunch360.com/?' + unique
    endpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + urllib.parse.urlencode({'url': target, 'strategy': strategy})
    started = utc()
    run = subprocess.run(['curl', '--silent', '--show-error', '--max-time', '150', '--include', '--output', str(out / ('pagespeed-' + strategy + '.response.txt')), '--write-out', '%{http_code}', endpoint], capture_output=True, text=True)
    record = {'service': 'Google PageSpeed Insights API (unauthenticated)', 'strategy': strategy, 'target': target, 'utc_start': started, 'utc_end': utc(), 'http_code': run.stdout, 'exit_code': run.returncode}
    (out / ('pagespeed-' + strategy + '.metadata.json')).write_text(json.dumps(record, indent=2))
    (out / ('pagespeed-' + strategy + '.stderr.txt')).write_text(run.stderr)
    print(json.dumps(record), flush=True)
(out / 'summary.json').write_text(json.dumps(results, indent=2))
