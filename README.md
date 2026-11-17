# N8VCL NTS Traffic Logger — User Manual

A desktop logbook for amateur radio NTS traffic handlers. Paste in a jumbled list of radiograms and it sorts them by where they're going, gathers matching messages into books, and keeps track of every message you **receive**, **originate**, **relay**, and **deliver** — who it came from, on what net, and when (UTC), and the same for where it went.

Everything is stored on your own computer. No internet connection is needed, except to check for a newer version of the app.

## Quick Start

1. Go to **Settings** and fill in **My Station** (callsign, city, state, next message number).
2. Under **My Delivery Area**, enter the ZIP codes (or ZIP prefixes like `432`) and/or cities you deliver to. Traffic addressed there is sorted under **Deliver**; everything else is sorted under **Relay**, grouped by state.
3. Under **My Nets**, add the nets you check into: name, days, start time, length, frequency, and a note (e.g. "Liaison to 8RN").
4. Go to **Enter Traffic**, paste the messages you copied, and click **Sort & preview**.

## Dashboard

- **Today's date** with local and UTC clocks.
- **Upcoming Nets** for the next week, with local and UTC start times and a countdown ("in 45m", "On now").
- **Tiles**: messages waiting to relay, waiting to deliver, Priority/Emergency waiting, messages waiting longer than your overdue limit (48 hours by default), and today's received / relayed / delivered / originated counts.
- **Traffic Waiting**: every open message, grouped as:
  - **Deliver — my area**
  - **Relay — OH**, **Relay — PA**, … one group per destination state
  - Inside each group, messages are sorted by precedence (Emergency, Priority, Welfare, Routine), then ZIP code.
  - Messages in the same group with the same **check**, **place of origin**, **text**, and **signature** are shown together as a **BOOK OF n**. Their precedence, HX, station of origin, time, and date may differ. Whatever is the same for all of them goes in the book's header, and whatever differs goes on each message's own NR line.

Each row shows the precedence, number, addressee, destination, phone, where it came from, and how long it has been waiting. Click a row to see the whole radiogram. Clicking a message that's inside a book shows only that message's own part, its NR line and address, since the text is on the book; **Whole message** shows the full radiogram.

**Relaying or delivering:**
- Click **Relay** or **Deliver** on a row, or
- Tick several rows (or click **Select** on a book) and use **Relay selected…** / **Deliver selected…**, or
- Click **Relay book…** on a book to log all of its messages at once.

**On the air — one-click relays.** The **On the air** bar above the list is for when you're passing traffic on a net and don't want to keep the other station waiting:

- **Net** fills itself in with whichever of My Nets is on now. Type over it for a net that isn't in your list.
- Enter the station taking traffic in **Sending to**. The bar lights up and every Relay button changes to **Relay → W8ABC** (and **Relay book → W8ABC**, **Relay 3 → W8ABC**). One click logs the relay to that station, on that net, at the current UTC time.
- The confirmation at the bottom has an **Undo** button for about ten seconds. After that, open the message from the Log and use **Return to waiting**.
- When another station takes traffic, type the new callsign. **Clear** turns one-click relaying off.

With **Sending to** empty, Relay opens the usual window. It comes filled in with the net that's on now and the last station you relayed to in the past three hours, so **Enter** is usually all it needs.

A relay records the station you passed it to, the net, and the UTC date and time. A delivery records who it was delivered to, how (phone, email, in person, mail, …), and the UTC time. **Undeliverable…** records the reason and the station you sent a service message to.

**Copy as book** on a book puts the traffic on the clipboard in book form, ready to read or send:

```
BOOK OF 2 R 8 HARTFORD CT
BT
HAPPY THANKSGIVING FROM ALL OF
US X 73
BT
NEW ENGLAND TRAFFIC NET
NR 101 K1NXT NOV 10
AL ADAMS
AKRON OH 44301
NR 57 KN1OBI NOV 12
BETTY BAKER
CANTON OH 44702
AR
```

Here the two messages came from different stations on different dates, so the station and date are on each NR line. When everything in the preamble matches, the NR line is just the number. An **op note** that is the same on every message of the book is given once, right after the signature; op notes that differ stay with their own messages.

## Enter Traffic

### Paste a list of messages

Paste any number of radiograms into the box. They can be:

- one field per line, the standard way,
- run together on one line (`NR 45 P KD8ABC 7 DAYTON OH 1200 NOV 9 MARY JONES 45 ELM AVE ... BT ... BT BILL AR`),
- already in book form (`BOOK OF 3 R HXG W3XYZ 9 HARRISBURG PA 0900Z NOV 11` followed by the text and `NR 101`, `NR 102`, … with their addresses; NR lines can carry their own station, time, or date, like `NR 57 KN1OBI NOV 12`), or
- any mix of these, in upper or lower case, with net chatter or headers in between.

Then fill in **Received from**, **Net**, and the **UTC date/time** (or choose **I originated these**) and click **Sort & preview**.

The preview shows each message under its Deliver/Relay group with its book letter. It also flags anything worth checking:

- the **check** doesn't match the number of words in the text (the check is kept as received; the counted value is shown next to it),
- an address that came in on one line and was split automatically,
- a message with only one `BT`, or none,
- a message that's already in your log, which is unticked so it won't be added twice,
- lines that weren't part of any message, under "lines were not part of any message".

Click any row to correct it, untick anything you don't want, then click **Add n to Waiting**.

### Single radiogram

A form for one message: preamble, address, text, signature, and op note.

- The **check is calculated as you type the text**: it counts the words and adds `ARL` when ARL numbered texts are used. You can type over it. If you do and it doesn't match the text, you'll see a warning with a **Use** button to put the counted value back.
- Choose **I originated this message** and the number, station of origin, place, time filed, and date are filled in for you. The number comes from **Next message number** in Settings and goes up by one each time you originate a message.
- **Save to Waiting**, or **Save & log relayed…** / **Save & log delivered…** if you've already passed it on.

## Log

Every message, newest activity first, with where it came in from and where it went. Filter by status (relayed, delivered, undeliverable, waiting), date range, or search for a callsign, name, city, net, or a word in the text. Click a message to view, copy, edit, or delete it, or to **Return to waiting** if something was logged by mistake. **Export CSV** saves the filtered list.

## Reports

Choose a period: today, yesterday, this week, this month, last month, this year, all time, or custom dates. The report shows:

- **Received**, **Relayed (sent)**, **Delivered**, **Originated**, and **Total handled**, counted the same way as the ARRL Station Activity Report, plus **Undeliverable**.
- How close you are to BPL (500 total, or 100 originated + delivered).
- Received and relayed counts **by net** and **by station**.
- Deliveries by method, and traffic by precedence.
- A **by-day** table.

**Copy summary** puts a short text report on the clipboard for posting. **Export CSV** saves every event in the period.

Whether "today" and the report periods run on **local days or UTC days** is set in Settings → Preferences.

## Settings

- **My Station** — callsign, name, city/state (used as the place of origin), next message number.
- **My Delivery Area** — ZIP codes/prefixes and cities you deliver to. You can override the sorting for a single message with **Sort under** when editing it.
- **My Nets** — name, days of the week, start time (local or UTC), length, frequency/mode, notes. These fill the Dashboard and the Net choices when logging.
- **Preferences** — theme, local or UTC days, overdue hours, 12/24-hour clock.
- **Backup & Restore** — save everything to a `.json` file, or restore from one. Make a backup now and then, and before moving to a new computer.
- **Automatic Snapshots** — see below.

The app's **version** is shown at the top right of Settings, next to **Check for Updates**.

## Updates

The app looks for a newer version each time it starts. When there is one, a bar at the top says so:

- **Install Update** downloads it, installs it, and restarts the app. The download is checked against the project's signing key first, so only genuine releases are accepted.
- **What's New** shows what changed in that version, right in the app.
- **Later** puts it off until the next start. **Check for Updates** in Settings looks again any time.

Version 1.3.0 is the first that can update itself. From 1.2.0 or earlier, download and install 1.3.0 by hand once.

## Where your traffic is kept

The installed app keeps your traffic in a file in its own data folder, not in the web view's storage, so there is no size limit and it stays put when the app is updated or reinstalled. **Open Data Folder** (Settings → Backup & Restore) shows where it is; to move to a new computer, a backup file is still the simplest way.

The first time version 1.3.0 or later starts, it moves your existing traffic into that file, checks that it arrived whole, and leaves the old copy where it was.

Only one copy of the app runs at a time: starting it again brings the open window forward.

### Automatic Snapshots

The app keeps its own copy of your traffic from **before each day's changes**, for the last **7 days it changed**. They are listed under Settings → Backup & Restore, each with a **Restore** button.

- A restore can be undone: what you had just before a restore (from a snapshot or a backup file) is kept as **Before the last restore**.
- If the traffic file is ever damaged, the app restores the newest snapshot at startup, tells you so, and keeps the damaged file in the data folder.
- Snapshots are on the same computer as your traffic, so keep saving backups too.
