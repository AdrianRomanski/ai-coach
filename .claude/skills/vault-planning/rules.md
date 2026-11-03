# The user's planning rules

These are the user's own rules. They win over general planning advice. The rules below are sensible defaults and examples: edit, delete or add to them to match how you plan. If the user states a new rule in a session, follow it there and suggest adding it here.

## Load

- **No capacity pushback.** Show the load (size points per day: S 1, M 3, L 8) as information, never as a warning. Some days have to hold more. Don't suggest moving or cutting work because a day is heavy unless the user asks.

## Scheduling

- **Lead times first.** Work with a supplier lead time (badges, t-shirts, stickers, print) or that waits on another person goes early in the week, so the wait runs while other work gets done.
- **Chase blockers first, dependent work last.** When work needs someone's input (an abstract, a picture, an approval), schedule the chase on the first day and the dependent tasks last. Example: speakers with missing abstracts go last in an announcement run.
- **Graphic before post.** A graphic is scheduled on an earlier day than its post.
- **Posting cap (example).** At most 4 social media posts a day, at 12:00, 14:00, 16:00 and 18:00. The posting time goes into the task text: `… announced on social media 14:00 #S ⏳ 2026-11-04`. Before scheduling a post, count the posts already on that day and give the next free slot. Delete this rule if you don't post on a schedule.
- **Repeating tasks** (🔁) carry only their next date and are never rescheduled for planning; the day query lists them.
- **Habits never carry over.** A routine such as getting up at 6:00 is a habit, defined with `add_habits` and checked off in the day plan; a day it is not ticked is missed, not moved to the next day.

## Where work belongs

- **One-off effort** goes in a project workstream (Deep clean, a meetup). **Repeating upkeep** goes in an area as 🔁 tasks (cleaning cycles go to Home; a diet goes under Health).
- **Personal habits** (up at 6:00, walks, reading) are habits defined under `## Habits` in a workstream of one personal project, here called the **habit project** (example: Healthy Year). Sessions whose days the user picks each week, such as gym, stay as tasks (`Gym #M`) in their workstream. The matching area (Sport, Reading) holds no tasks: it describes the habit and links the workstream. A habit goal links the workstream first, then the area: `Gym 4 times [[Gym and walks]] [[Sport]]`.
- **Recurring yearly projects** (example: Meetups `<year>`) are one project per year with deadline 31 December. Each event is a workstream (`Meetup YYYY-MM-DD`). The project note carries a ⏳ 1 January task to start next year's project.
- **Orders that share a supplier** are placed together, on the same day.

## Known projects

A snapshot to help with names. `planning_overview` is the truth. Fill it in with your own projects, or leave it empty.

| Project        | Deadline                              | Workstreams                                |
| -------------- | ------------------------------------- | ------------------------------------------ |
| Conference2026 | 2026-11-14                            | Talks, Marketing (folder), Workshops       |
| Meetups 2026   | 2026-12-31                            | Meetup 2026-11-12                          |
| Healthy Year   | 2027-10-31                            | Morning routine, Deep clean, Gym and walks |
| Podcast        | none; done when 20 episodes published | Recording, Publishing                      |

Areas: Finances, Health, Home, Reading, Sport, Work.

- **Projects with no deadline on purpose** are listed here (example: Podcast, planned by episodes published). Don't ask for a deadline for them.
- **The habit project** is where new personal habits and routines go. When a new habit comes up, offer it as a workstream of the habit project.
