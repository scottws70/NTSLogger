# N8VCL NTS Traffic Logger — User Manual

A desktop logbook for amateur radio NTS traffic handlers. Paste in a jumbled list of radiograms and it sorts them by where they're going, gathers matching messages into books, and keeps track of every message you **receive**, **originate**, **relay**, and **deliver** — who it came from, on what net, and when (UTC), and the same for where it went.

Everything is stored on your own computer. No internet connection is needed.

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
  - Messages in the same group that share the same preamble, text, and signature (only the number and address differ) are shown together as a **BOOK OF n**.

Each row shows the precedence, number, addressee, destination, phone, where it came from, and how long it has been waiting. Click a row to see the whole radiogram.

**Relaying or delivering:**
- Click **Relay** or **Deliver** on a row, or
- Tick several rows (or click **Select** on a book) and use **Relay selected…** / **Deliver selected…**, or
- Click **Relay book…** on a book to log all of its messages at once.

A relay records the station you passed it to, the net, and the UTC date and time. A delivery records who it was delivered to, how (phone, email, in person, mail, …), and the UTC time. **Undeliverable…** records the reason and the station you sent a service message to.

**Copy as book** on a book puts the traffic on the clipboard in book form, ready to read or send:

```
BOOK OF 2 R N8VCL ARL 8 TOLEDO OH NOV 10
BT
ARL FIFTY ARL SIXTY ONE
CONGRATULATIONS X 73
BT
SALLY KD8ZZZ
NR 7
BOB BROWN
...
AR
```

## Enter Traffic

### Paste a list of messages

Paste any number of radiograms into the box. They can be:

- one field per line, the standard way,
- run together on one line (`NR 45 P KD8ABC 7 DAYTON OH 1200 NOV 9 MARY JONES 45 ELM AVE ... BT ... BT BILL AR`),
- already in book form (`BOOK OF 3 R HXG W3XYZ 9 HARRISBURG PA 0900Z NOV 11` followed by the text and `NR 101`, `NR 102`, … with their addresses), or
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
