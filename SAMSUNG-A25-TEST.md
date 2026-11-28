# Inside Mauritius — Samsung A25 private local testing

Review snapshot: 322b70749a849926cf4a57ff167677b996a2bdfb
Main baseline: f22ca8e8ea65bd4044a96df04b1efe83464be8c7
No merge or deployment is authorized.

## Windows laptop and Samsung A25
1. Download the Samsung-A25-review ZIP from the review workflow's artifacts, or download the candidate branch source ZIP. Extract it on your Windows laptop. Open the extracted folder containing index.html.
2. On Windows, install Python 3 if it is not already installed. Run START-SAMSUNG-TEST.cmd in that folder. It prints private network addresses; select the actual Wi-Fi IP to start the server on port 8765.
3. Connect both devices to the same trusted home Wi-Fi. Use only a Private Windows network; if Windows asks for firewall permission, allow Private networks only. Do not disable the firewall or configure router port forwarding. On the Samsung phone, open Chrome and enter the printed http://192.168.x.x:8765/ (or other actual private address). Do not use localhost on the phone.
4. Test the homepage, World News, Live Updates, gallery and Cyclone Watch. The package contains dated snapshots, not live operational forecasts. External images, map tiles, news links and other network-dependent features require Internet access; never treat a local snapshot as current safety advice. Do not sign in to analytics or enable analytics consent during the local test. Production OAuth may reject local origins by design.
5. Stop the server by pressing Ctrl+C on the laptop when finished. Do not upload the test package to a public server.

## Device checklist
- Homepage loads and fits the screen in portrait and landscape; navigation works.
- Read a local news story; test play, pause, next, stop and consecutive playback. Test morning and retrospective evening bulletins.
- Gallery shows four historical photographs with attribution, source and license links; open and close an image.
- Open Cyclone Watch; select satellite animation and weather model panels; check dates, play/pause and zoom. Offline network-dependent tiles may be unavailable.
- On Chrome, test with Wi-Fi online and offline, and note any failures separately. Do not use these archived forecasts for travel or weather decisions.
- Record Samsung A25 Android/Chrome versions and PASS/FAIL for each item. Physical hardware verification is manual.
- Stop the server. Return the checklist results for review; do not merge or deploy.

The candidate's website files are preserved from the audited snapshot. GitHub artifact access follows repository permissions; downloading and testing on your own network is not a private-hosting guarantee. Do not place secrets in this static package.
