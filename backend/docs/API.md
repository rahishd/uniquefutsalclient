# API for the new customer app

Base URL `/api`. Responses look like `{ success, statusCode, message, data }`. Errors use the same shape with the
HTTP status. Auth is `Authorization: Bearer <token>` (from `/auth/login` or `/auth/signup`).
**Guest** = no token. **User** = signed-in customer. **Captain** = user in Captain mode with a team. **Staff** = admin token.
Times use Nepal time. Dates are `YYYY-MM-DD`. Money is whole rupees.

## Status of the frontend features

| Feature | Status |
|---|---|
| Login, signup (phone + password, OTP off), profile, preferences, Player/Captain mode, push subscriptions | Done |
| Court slots and prices, booking checkout, quote, guest rules, 10-day window, held slot, expiry | Done (single pool of hours; see "Courts") |
| Payments: QR order, status polling, staff mark-paid, expiry job, test gateway | Done. Real Fonepay adapters need merchant keys |
| Promos list and validation | Done (reads the developer's promo codes in Settings) |
| Loyalty points ledger, expiry, free-game vouchers, goods sales, awards | Done |
| Gamezone catalog, per-console slots, booking, payments, cancel | Done |
| Teams, roster (max 12), challenges, results, approval, rating, ranking, disputes, "Did you win?", settlement | Done |
| Notifications, 1-hour reminder, "I'm coming" check-in, Quick Rebook | Done (Web Push sending is not built yet) |
| Tournament tie-sheet | Done |
| Site info | Done |
| Membership for the new app (Basic/Premium x monthly/3/6 months) | **Not built: needs the owner's decision.** The developer's membership module still runs and now awards points |
| Closed-app Web Push, SMS reminders | Not built (needs VAPID keys / SMS provider) |
| Real payment gateway | Not built (needs merchant keys) |

## Auth and profile

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/signup` | Guest | `{name, phoneNumber (9XXXXXXXXX), password>=6, dateOfBirth (YYYY-MM-DD, required: a real date, age 5 to 100), emergencyName (required), emergencyPhone (required, 9XXXXXXXXX, not the customer's own number), emergencyRelation?, email?}` -> `{token, refreshToken, user}`. 400 without a real date of birth or a valid emergency contact. 409 if the number already exists (an existing account is never taken over) |
| POST | `/auth/login` | Guest | `{identifier: phone, password}`. Limited to 5 tries / 15 min / IP |
| POST | `/auth/refresh` | Guest | `{refreshToken}` |
| POST | `/auth/passkey/register/options`, `/auth/passkey/register/verify` | User | Turn on Face ID / fingerprint sign-in for this device (WebAuthn passkey, platform authenticator, user verification required). Options return `{options, challengeToken}`; verify takes `{response, challengeToken, deviceName?}`. Only the public key is stored (table `Passkey`) |
| GET / DELETE | `/auth/passkey`, `/auth/passkey/:id` | User | List this customer's Face ID devices; turn one off |
| POST | `/auth/passkey/login/options`, `/auth/passkey/login/verify` | Guest | Sign in with Face ID, no number or password (discoverable credential). Same result as `/auth/login`; customers (role user) only, suspended accounts refused. Limited like login. Needs `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGINS` in production |
| GET | `/auth/me` | User | account basics and `loginCount` (sign-ins so far; counted on password sign-in, OTP sign-in and registration, not on token refresh) |
| POST | `/auth/check-phone` | Guest | `{exists, isVerified}` only |
| POST | `/auth/verify-otp`, `/resend-otp`, `/forgot-password`, `/reset-password` | - | 503 while `OTP_ENABLED=false` |
| GET/PATCH | `/me/profile` | User | `customerCode, name, phone, email, dateOfBirth, age, emergencyName, emergencyPhone, emergencyRelation, location, position, status, mode`. PATCH may send `emergencyName` + `emergencyPhone` (+ `emergencyRelation`) together to add or replace the emergency contact (it cannot be removed; never the customer's own number). `GET /auth/me` returns `hasEmergencyContact` so the app can remind those who skipped it. Phone cannot change. PATCH may send `dateOfBirth` only while none is saved (accounts from before it was asked); a saved one is changed by venue staff (409) |
| GET/PUT | `/me/preferences` | User | `smsReminders, promoNotifications, popupReminder, language(en/ne)` |
| PUT | `/me/mode` | User | `{mode: player|captain}` |
| GET | `/push/public-key` | Guest | `{enabled, publicKey}` (VAPID) the app needs to subscribe a device |
| POST/DELETE | `/me/push-subscriptions` | User | Web Push subscription of this device. Every new notice is also pushed to all devices (not for promos if promos are off, not for the 1-hour reminder if the pop-up reminder is off; dead devices are removed) |
| GET | `/me/gameplay` | User | `{totals:{games,goals,assists,withStats}, games:[{id,code,date,time,goals,assists}]}`; goals/assists are `null` for older games that were never recorded |
| PUT | `/bookings/:id/player-stats` | Staff | `{stats:[{phone,goals,assists}]}` for a game that has started; replaces a player's numbers; players must be registered |
| GET | `/auth/google/config` | Guest | `{configured, clientId}` for the Google button |
| GET | `/auth/google/status` | User | `{configured, linked, email}` |
| POST | `/auth/google/link`, `/auth/google/unlink` | User | link the Google account (`{idToken}`, verified server-side against `GOOGLE_CLIENT_ID`) used to reset a forgotten password |
| POST | `/auth/reset-request` | Guest | `{phoneNumber}`: asks the venue to reset a forgotten password. Creates one open "Password reset" complaint (staff see it in Complaints, call the customer and set a new password in Customers). Always answers 200 with the same text, so it cannot be used to look numbers up. 5 tries / 15 min / IP |
| POST | `/auth/reset-password/google` | Guest | `{phoneNumber, idToken, newPassword}`: allowed only when the Google account is the one linked to that number. 5 tries / 15 min / IP |
| GET | `/me/payments` | User | paid games and Gamezone sessions, and final bills made at the venue counter (`kind: "bill"`, with `lines[{type,label,quantity,amount}]` and `points`; a game paid inside a bill is not listed twice). Table `Checkout`, migration `20261013000001_checkouts`, written by the admin portal |

## Courts, bookings, payments

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/bookings/available?date=` | Guest | free slots (existing endpoint) |
| GET | `/bookings/occupancy?date=` | Guest | taken hours only; staff with a token also see names/phones |
| GET | `/bookings/slots?date=` | Guest | Free hours for a date (today..+10 days, Nepal time) -> `{date,slots:[{hour,startTime,endTime,price}]}` |
| POST | `/bookings/quote` | Guest | `{date,startTime,duration?,promoCode?,voucherId?}` -> `{basePrice,discount,total,promo,vip,water,usesVoucher,earnPoints}`; `water` is `{bottles, excluded}`: the 2 complimentary mineral water bottles, or 0 with `excluded: "vip"` (a VIP discount applies) or `"promo"` (a promo code applies and staff did not switch `includesWater` on for it). The booking stores the same number in `waterBottles` |
| GET | `/bookings/bulk/allowance` | User | `{limit:5, used:{<Monday of week>: n}}`: bulk games already held per calendar week (Monday to Sunday). At most 5 per customer per week; `/bookings/bulk/quote` and `/bookings/bulk` answer 409 above that |
| POST | `/bookings/bulk/quote` | User | `{slots:[{date,startTime}] (1..10, today..+7), promoCode?}`. Prices every hour on its own; the promo counts only on hours where it is valid. Returns `{slots,subtotal,discount,total,advance,promo}` |
| POST | `/bookings/bulk` | User | `{slots, mode: advance|full, promoCode?}`. Fonepay only (50% advance or full). Holds every hour (10 minutes, tagged `BULK:<code>`), makes ONE order `BLK-XXXXXX` (purpose `bulk`) -> `{code,total,payNow,restAtVenue,bookings,payment}`. When paid, all hours confirm and the amount is shared across them in proportion to price; unpaid, all are released together |
| POST | `/bookings/checkout` | Guest or User | `{date,startTime,duration?,method: fonepay|venue,promoCode?,voucherId?,guest?:{name,phone}}`. Guest: details required, `venue` refused (403), no voucher. User: no guest details. Window today..+10. Online -> `{booking, payment:{orderCode,amount,remarks,qrPayload,expiresAt}}` and the slot is held 10 minutes |
| GET | `/bookings/me` | User | my bookings (membership ledger rows hidden) |
| POST | `/verify` | Public | `{code}` (4 to 6 digits): is this bill or document genuine? 200 `{genuine, kind: payment|document, bill|document}` (customer name shortened, no phone); 404 = not genuine ("may be fake"); 400 bad format; 429 after 8 wrong codes from one connection in an hour. Every receipt in `GET /me/payments` carries `verifyCode` |
| GET | `/bookings/me/rebook` | User | weekday+hour of the last game played and the next such weekday (same hour, else the nearest open hour), or `null` |
| GET | `/bookings/:id` | Owner/Staff | |
| POST | `/bookings/:id/cancel` | Owner | keeps the record; frees the slot; returns a used voucher |
| POST | `/bookings/:id/arrival` | Owner | "I'm coming": from 1 hour before to 30 minutes after the start |
| GET | `/bookings/arrivals` | Staff | who is on the way |
| GET | `/payments/:orderCode/status` | Owner, or guest with `?phone=` | `pending|paid|expired`. Only the gateway/staff change it |
| POST | `/payments/:orderCode/mark-paid` | Staff | |
| POST | `/payments/:orderCode/test-pay` | local/test only | simulates the gateway |
| POST | `/payments/webhooks/fonepay` | gateway | 501 until configured; must verify the gateway signature |

`startTime` is `HH:mm`. A booking made with a voucher costs Rs. 0, is confirmed at once, and uses up the voucher.

## Promos, loyalty

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/promos` | Guest | `code,title,description,discount,kind,until,daysLeft,terms,status` |
| POST | `/promos/validate` | Guest | `{code,date,startTime}` |
| GET | `/loyalty/me` | User | `remaining, earned, claimed, expired, expiringSoon, byType, rows[], shifts[{period,price,perGame,cost,canClaim}], vouchers[], toNext` |
| POST | `/loyalty/claim` | User | `{period: Morning|Day|Evening}` -> voucher. 409 if not enough points. Locked so a double tap cannot spend twice |
| GET | `/loyalty/share/friend/:phone` | User | the registered customer a number belongs to, first name only (400 bad number or yourself, 404 not registered) |
| DELETE | `/loyalty/vouchers/:id` | User | Cancel your own unused free game voucher: it is voided and its points come back as new entries (kind `free_game`) with the same expiry dates they were spent from (vouchers claimed before this was recorded get 3 months from today) -> `{id, period, refunded}`. 409 if already used or already cancelled, 404 for someone else's voucher |
| POST | `/loyalty/share` | User | `{friendPhone, points}`: send exactly 10 points per share to another registered customer -> `{id, points, to, remaining}`. The sender must hold at least 100 points to share at all (409 below that, and 409 if the share is more than they have), 429 after 3 shares in 24 hours. Locked per sender with `claim`. `GET /loyalty/me` also returns `share:{min,max,minBalance,perDay}` |
| POST | `/loyalty/goods-sale` | Staff | `{phone, amount, items?}`: 1 point per Rs. 100 |

Promo use limits: staff can set `maxUses` (everyone together) and `maxPerCustomer` on a code in the admin portal. A use is a booking or membership carrying the code that is not cancelled, so cancelling gives it back. A code with no uses left is not listed by `GET /promos`. `POST /bookings/quote` answers `promo:{ok:false,message}`, and `/bookings/checkout` and the membership request answer 400 ("This promo code has been fully used." / "You have already used this promo code."). It is checked just before the booking is saved, not under a lock, so two people taking the last use at the same instant could both get it.

Rules (single source: `src/utils/loyaltyPoints.ts`): a completed and paid regular game earns price/100 points (1 decimal);
a free game costs price/10; goods Rs. 100 = 1 point; membership 3 months 30 / 6 months 70; challenge win 5 (winning captain only).
Game and challenge points last 3 months, goods 1 year, membership never; claims spend the soonest-expiring points first.
Awards are idempotent per source. Free-game bookings, guests, membership ledger rows and challenge bookings earn no game points.
Sharing: the sender gets one `shared_out` row (negative, source `share`), the friend one `shared_in` row per expiry date. The points that expire soonest go first and keep their expiry (never-expiring stay never-expiring), so sharing cannot extend how long points last. Both people get a points notice that opens their row.

## Gamezone

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/gamezone/catalog` | Guest | consoles, games, plans, rules |
| GET | `/gamezone/slots?date=&hours=&consoleId=` | Guest | free start hours for that console |
| POST | `/gamezone/bookings` | Guest or User | `{date,hour,hours,players(1/2/4),consoleId,game,method,guest?}`; total = rate x players x hours (server) |
| GET | `/gamezone/bookings/me` | User | |
| POST | `/gamezone/bookings/:code/cancel` | Owner | before the session starts |
| POST | `/gamezone/bookings/:code/arrival` | Owner | check-in window like court bookings |
| GET/POST | `/gamezone/admin/bookings`, `/admin/bookings/:code/mark-paid` | Staff | |
| POST/PATCH/PUT | `/gamezone/admin/games|consoles|plans` | Staff | manage the catalog and rates |

## Captain mode

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/teams` | User in Captain mode | `{name 2-30}` |
| GET | `/teams/me` | User | roster (with phones) for my own team |
| POST/DELETE | `/teams/me/members`, `/teams/me/members/:userId` | Captain | add by phone (registered, in no other team, max 12); the captain cannot be removed |
| GET | `/teams/find?q=` | Captain | Find Player: teams by the start of the captain's mobile number (5+ digits) or by team name (2+ letters), max 10, never your own team: `[{id,name,area,players,record,rating,rank,captainName}]`. A shorter search returns `[]` |
| GET | `/teams/ranking`, `/teams/:id` | Captain | rating (1-5, needs 3 approved games), rank, record, form. Team stats only |
| GET/POST | `/challenges` | Captain | create needs >= 5 players, `loserPct` 70/60/100 with no default, date within 10 days |
| POST | `/challenges/:id/accept|decline|cancel` | Captain | accept creates the court booking (the unique hour guard decides races) |
| POST | `/challenges/:id/result` | Winning captain | `{myScore, theirScore}` overall score only, 0-50, after the game starts |
| POST | `/results/:id/approve|dispute` | The other captain | approve updates records and awards 5 points to the winner |
| GET | `/challenges/pending`, `/challenges/prompts/did-you-win`; POST `/challenges/:id/prompt-shown` | Captain | tile badge and "Did you win?" |
| POST | `/teams/admin/challenges/:id/venue-paid` | Staff | prompts both captains |
| POST | `/teams/admin/results/:id/resolve` | Staff | `{action: approve|void, scoreSubmitter?, scoreOther?, note?}` |
| GET | `/teams/admin/settlements?date=` | Staff | who owes what at the venue |

## Membership (existing customers, no extra sign-up)

Each subscription has a `memberCode` (MEM-10001...), the Membership ID shown to the member; staff create it in the admin portal when the membership is made (migration `20261014000001_member_code`, nullable and unique). Subscriptions made before this have none until staff renew or verify them. The admin portal also creates, verifies, renews, extends, suspends and cancels memberships (`suspended` and `cancelled` free the hour); the customer app keeps blocking the hour of `active` and `pending` memberships.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/membership/offers` | Guest | active plans with `prices[1_month|3_months][morning|day|evening]` after the plan discount (`null` = not offered) |
| GET | `/membership/mine` | User | `{current, history}` |
| POST | `/membership/request` | User | `{planId, timeSlot "07:00-08:00", duration, startDate}`; price is computed on the server; creates a PENDING subscription; staff verify the payment (`/membership/subscriptions/verify-payment`) to activate it. 4 PM - 8 PM is never offered |

Bookings now carry a short display `code` ("UF-7K3QX9", `scripts/backfill-booking-codes.ts` fills older ones). Cancelling a booking or a Gamezone session is free until it starts; a paid online order becomes `refunded` with a `REFUND_DUE` payment event for staff, and the response has `refundDue`.

## Other

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST/DELETE | `/notifications`, `/notifications/read`, `/notifications/:id/read` | User | unread counts per type for the Popular tile badges |
| GET | `/tournaments/current` | Guest | current tournament and tie-sheet; each match has `goals[{side: home|away, minute, scorer}]` in minute order (table `MatchGoal`, migration `20261018000001_match_goals`, entered in the admin portal) |
| PUT | `/tournaments/:id/tiesheet` | Staff | save rounds and matches IN PLACE: a match keeps its row (and its followers) when its `id` is sent back, or, when a round sends no ids, by its order in the round; matches left out are removed. Followers get a notice (type `tournament`) at kick-off, on every goal of a live match and at full time |
| GET | `/tournaments/following` | User | ids of the unfinished matches I follow |
| PUT, DELETE | `/tournaments/matches/:id/follow` | User | follow or stop following a match (404 unknown, 409 finished, max 20); table `MatchFollow` (migration `20261017000001_match_follow`, deleted with the match) |
| GET | `/tournaments`, `/tournaments/:id` | Guest | safe summary; staff get everything |
| GET | `/tournaments/events` | Guest | tournaments the venue hosts for a manager that are on or coming: `{id,name,hostName,startDate,endDate,days:[{date,startHour,endHour}]}`. The manager phone number, the rate and the bill are never returned. `/tournaments/current` also carries `hosted:{hostName,days}` for a hosted event. Columns `hostedEvent, hostName, hostPhone, minRate, billClosedAt, createdBy` and table `TournamentDay` come from migration `20261019000001_tournament_hosting` (the admin portal makes the events and holds the court hours) |
| GET/PATCH | `/site` | Guest / Staff | contact details |

## Background jobs (`src/tasks/cron.ts`, `src/jobs/app.jobs.ts`)

Every minute: expire unpaid QR holds and free the slot. Every 10 minutes: 1-hour reminders (bell) and close unanswered
challenges. Daily 09:00: warn about loyalty points expiring within 30 days. The developer's jobs (auto-complete, SMS reminders,
membership expiry SMS, daily report) still run.

## Courts

The developer's system has one pool of hours (no separate Court 1 / Court 2). The frontend demo showed two courts. If the
venue really has two courts, add a `courtId` to `BookingSlot` and the checkout (a small, additive change). Until then each hour
can be booked once.

## Complaints

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/complaints/categories` | Guest | `{categories[{id,label}], messageMin, messageMax, maxPhotos, perDay}` |
| POST | `/complaints` | User | `{category, message (10-1500), bookingCode?, photos?: [image data URLs, max 3]}` -> complaint with code `CP-XXXXXX`. `bookingCode` must be on the caller's own account (400). 5 per 24 hours (429). Photos: JPG/PNG/WebP, 8 MB each before compression; decoded and re-encoded server-side, saved as JPEG |
| GET | `/complaints/me` | User | own complaints, newest first, with `status`, `staffReply`, `photos` (paths under `/uploads/complaints/...` or full R2 URLs) |
| GET | `/complaints/admin?status=&page=&limit=` | Staff | all complaints with `userId` and `customerName` |
| PATCH | `/complaints/admin/:id` | Staff | `{status?: open|in_review|resolved|closed, reply?}`; notifies the customer (`type: "complaint"`); audited |
| GET | `/wheelchair/options` | Guest | `{maxPeople, noteMax, daysAhead, perDay}` for the Wheelchair Request form |
| POST | `/wheelchair` | User | `{date (YYYY-MM-DD, today to +60 days), time (HH:MM), people? (1-10), note? (max 500), bookingCode?}` -> request with code `WC-XXXXXX`, status `pending`. `bookingCode` must be the caller's own booking. 3 requests per customer per 24 hours (429 after) |
| GET | `/wheelchair/me` | User | own wheelchair requests, newest first, with `status` (pending, confirmed, completed, declined, cancelled) and `staffReply` |
| POST | `/wheelchair/:id/cancel` | User | cancels the caller's own request while it is `pending` or `confirmed` (409 otherwise). Staff answer in the admin portal (`/admin/wheelchair`), which notifies the customer with `type: "wheelchair"` |
| GET | `/insurance/options` | Guest | `{severities: [minor, emergency], maxPhotos, descriptionMax, daysBack, perDay, ambulance: "102"}` for the Claim Insurance form |
| POST | `/insurance` | User | `{patientName, patientPhone (the injured player's REGISTERED number), witnessName, witnessNameNe (Nepali, must contain Devanagari), witnessPhone?, severity: minor|emergency, incidentDate (YYYY-MM-DD, today back to 30 days), description? (max 1000), photos: [1-3 image data URLs, required]}` -> claim with code `IC-XXXXXX`, status `submitted`. 400 when the patient has no account. 3 claims per customer per 24 hours (429). Photos as for complaints, saved under `/uploads/insurance/...` or R2 `insurance/`. The patient is notified (`type: "insurance"`) when someone else files it. Needs a UTF-8 database for the Nepali name |
| GET | `/insurance/me` | User | claims the caller filed or that were filed for them (`filedByMe`), newest first, with `status` (submitted, in_review, approved, rejected, closed) and `staffReply` |
| POST | `/insurance/emergency-contact` | User | `{patientPhone}` -> `{patientName, contact: {name, relation, phone, masked} or null, ambulance}`: the emergency contact saved on that registered player's account, for "slide to call" (the app hands `phone` to the phone's dialer). 404 for an unknown number. Every lookup is logged (`EmergencyCall`, audit `EMERGENCY_CONTACT_LOOKUP`); 10 per caller per 24 hours (429) |
| GET | `/insurance/admin?status=&page=&limit=` | Staff | all claims with `userId` |
| PATCH | `/insurance/admin/:id` | Staff | `{status?, reply?}`; notifies the filer and the patient (`type: "insurance"`); audited. The admin portal has its own page (`/admin/insurance`) |

Table `Complaint` (migration `20261007000001_complaints`, additive). Notification type `complaint` added.

Tables `InsuranceClaim` and `EmergencyCall`, and `emergencyName`/`emergencyPhone`/`emergencyRelation` on `User` and `PendingSignup` (migration `20261107000001_insurance_claims`, additive). Notification type `insurance` added.

## Children's Academy (ages 10 to 14)

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/academy/info` | Guest | `{minAge, maxAge, perDay, terms{version,text,updatedAt}, sessions[{id,title,date,startTime,endTime,coach,capacity,seatsLeft}]}`. Only classes staff made visible, open and not yet started |
| POST | `/academy/enroll` | User | `{guardianName, guardianPhone, emergencyPhone, address, childName, childAge (10-14), healthStatus: healthy|condition, healthNotes (required for condition), sessionId, acceptTerms: true, termsVersion}` -> enrolment with code `AC-XXXXXX`. 400 bad fields, 404 class not available, 409 started / full / duplicate child / terms changed, 429 more than 5 a day. Capacity is checked under a row lock. Re-enrolling after cancelling reuses the row |
| GET | `/academy/mine` | User | own enrolments, newest first, with `canCancel` |
| POST | `/academy/enrollments/:id/cancel` | User | owner only, before the class starts |

Tables `AcademySession`, `AcademyEnrollment` (migration `20261010000001_children_academy`, additive). Terms live in `Settings` key `academyTerms` (`{version,text,updatedAt}`, edited from the admin portal; each edit raises the version). Notification type `academy` added. Staff manage classes, attendance and terms in the admin portal.

## Refer & Earn

A customer books a game for ANOTHER team on their own account, then files it here with that team's captain. Staff approve it in the admin portal, which writes the loyalty points (kind `referral`, valid 12 months) for BOTH people. The app never writes points.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/refer/rules` | Guest | `{enabled, referrerPoints, friendPoints, perDay}` (staff set the points in `Settings` key `referEarn`) |
| GET | `/refer/me` | User | `{rules, referrals[] (as referrer or as friend; `points` is what the caller gets), eligibleBookings[]}` (own, not cancelled, regular, last 30 days, not already sent) |
| POST | `/refer` | User | `{bookingCode, friendPhone, teamName}` -> referral `RF-XXXXXX`, pending. 404 booking not yours or friend not registered, 400 yourself / bad fields, 409 cancelled, too old or already referred, 403 paused, 429 over 5 a day. Friend is notified (`type: "referral"`) |
| POST | `/refer/friend` | User | `{name, phone}`. Registers a friend with no account: creates the account (verified, `mustChangePassword`) with a shared first password, returned ONCE as `{name,phone,password,points}` (only a hash is stored). 409 if the number has an account, 429 after 5 friends in 24 hours |
| GET | `/refer/friends` | User | The friends this customer registered: `{phone,name,signedIn,points}` |
| PATCH | `/auth/set-new-password` | User | `{newPassword}`. Only while `mustChangePassword` is true (a friend's first sign-in): no old password needed, must differ from the shared one. Login and `/auth/me` return `mustChangePassword`; the app shows a pop-up that cannot be closed. At that first sign-in the referrer and the friend each get 5 loyalty points (once, kind `referral`, source `friend-signup`) |
| POST | `/refer/book` | User | `{date, startTime "HH:00", friendPhone, friendName}`: one step. Reserves the slot on the caller's account (1 hour, pay at the venue, 10-day window) and files the referral for it; if filing fails (friend not registered, over 5 a day, ...) the reservation is cancelled again and the slot freed. Same errors as `POST /refer` plus 400 for a bad date/time |
| DELETE | `/refer/:id` | User | withdraw while pending (referrer only) |
| GET | `/gifts/rules` | Guest | Gift Card: `{rsPerPoint: 10, minPoints: 10, maxPoints: 500, perDay: 5}` |
| GET | `/gifts` | User | `{rules, gifts[]}`: gifts I sent (any status) and gifts I received (paid only); `role` sent/received, `otherName` is a first name only |
| GET | `/gifts/friend/:phone` | User | `{phone, firstName}` of a registered customer. 400 bad number or yourself, 404 not registered |
| POST | `/gifts/points` | User | `{friendPhone, points (whole, 10-500), message?}` -> `{gift, payment}`, order `GIFT-XXXXXXXX` for points x Rs. 10 (purpose `gift_points`). When paid: LoyaltyEntry kind `gift` for the friend (12 months), both notified. 429 over 5 gifts a day |
| POST | `/gifts/game/quote` | User | `{friendPhone, date, startTime}` -> the friend's price for that hour (their club / VIP discount counts) |
| POST | `/gifts/game` | User | `{friendPhone, date, startTime "HH:00", message?}`: 1-hour booking on the FRIEND's account (notes `GIFT_FROM:<buyer>`), held 10 minutes, paid in full by the buyer (order = booking id, purpose `game`). Unpaid: slot freed, gift `expired`. The friend cannot cancel a gifted game in the app (409) |

Table `Referral` (migration `20261011000001_refer_earn`, additive; one referral per booking). Notification type `referral` added.

## Digital ID (customer QR)

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/me/digital-id` | User | `{name, phone, payload "UFID1.<random 192-bit token>", createdAt, replacedAt, club: {member, validUntil}}` (`club.member` puts a gold "Unique Club Member" badge on the card); made on first use. The QR holds only the token, no personal data; only staff in the admin portal can resolve it |
| POST | `/me/digital-id/replace` | User | new token, the old QR stops working |

Table `DigitalId` (migration `20261015000001_digital_id`, additive). The admin portal has the same table (its `sql/015`) and the staff scan endpoints (see its `docs/API.md`).

## Venue Wi-Fi

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/wifi` | User | `{visible:false}` when staff switched it off or set no name. By default (`wifiAccess` not `all`) a customer with no confirmed game, Gamezone session or active membership slot from 60 minutes before to 30 minutes after now gets `{visible:true, locked:true, message}` and NOTHING secret. Otherwise `{visible:true, locked:false, ssid, password, open, qr}` where `qr` is the standard `WIFI:T:WPA;S:..;P:..;;` text (special characters escaped). Never cached. Guests get 401 |

Staff set `wifiSSID`, `wifiPassword`, `wifiVisible` and `wifiAccess` (`booked` default or `all`) (Settings keys) in the admin portal. The public `GET /settings` no longer returns the Wi-Fi name or password.

## Site content (gallery and ads)

Staff upload photos and ads in the admin portal (Site Content). The app reads them here; no sign-in needed. The server decides what is live (Nepal time), so a time-targeted ad appears and disappears by itself.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/content/active` | Guest | `{gallery[{id,title,caption,orientation: landscape|portrait|square,imageUrl}], ads: {header[], footer[], popup[], inline[]}}`; each ad has `{id,title,imageUrl,linkUrl,displaySeconds}`, pop-ups also `popupDelaySeconds` and `popupFrequency` (session|day|always). Only visible photos and ads that are live right now: active, inside the date range, on a chosen weekday, inside the daily hours window (a window may pass midnight) |
| GET | `/content/media/:id` | Guest | the picture (stored in the database as a 1600px JPEG), cached for a year |
| POST | `/content/ads/:id/view`, `/click` | Guest | counters for the venue's reports; only counted while the ad is live; always 204 |

| POST | `/content/visit` | Guest | body `{visitor}` (random id from the browser, 16-64 chars of A-Z a-z 0-9 _ -); counts one visitor per Nepal day and their page views for the admin Overview; no personal data kept; always 204 |

Tables `SiteVisit` (migration `20261016000001_site_visits`), `ContentMedia`, `SiteGallery`, `SiteAd` (migration `20261012000001_site_content`, additive; the older `Ad` and `Gallery` tables and `/ads` routes are left as they were).

## VIP discount code

Staff (admin portal > Customers) give one customer a VIP code such as `ADMINVIP`: `VipCode` (migration `20261009000001_vip_codes`, additive, one per customer), `type` percent or flat, `value`, `active`, `claimedAt`.
- The customer types the code in the booking promo box (`POST /bookings/quote`, `POST /promos/validate`, `POST /bookings/checkout`). Quoting with it marks it **claimed** (`claimedAt`). The response has `promo: {ok:true, code:"ADMINVIP", label:"VIP 10% off"}` and `vip: {code, label}`.
- Once claimed, it applies to **every later booking with nothing typed** (`vip` is set, `promo` stays null). A paused (`active:false`) or removed code stops at once.
- If a normal promo code is typed too, the bigger discount wins and `promo` names the one applied. A wrong code still reports "invalid" while the VIP discount keeps applying.
- Only the customer it was given to can use it. Anyone else (another customer, a guest) typing the same text gets "This promo code is invalid."
- The booking stores the code in `promoCode` and the amount in `discountAmount`, so staff can see how much it has saved.

## EV charging

Paid AC EV charging at the venue (Rs. 50 an hour, Settings key `evChargeRate`), billed by started quarter hours. Every route needs a signed-in customer. The QR at a port holds a link `/ev?port=<token>` (or `UFEV1.<token>`); staff make ports and QR codes in the admin portal.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/ev/me` | User | `{rate, blockMinutes, active, history[], owed}`; a session is `{id, status: charging|unpaid|paid|cancelled, port, startedAt, endedAt, minutes, rate, amount, paidAt, source}` |
| POST | `/ev/start` | User | `{code}` (scanned link, `UFEV1.token` or the bare token) -> the new session. 404 unknown or switched-off port, 409 if the port is in use or you are already charging (the database allows one charging session per port and per person) |
| POST | `/ev/:id/stop` | Owner | stops it and makes the bill (`unpaid`, amount worked out on the server); 404 for anyone else, 409 if already finished. Payment is taken at the venue by staff (admin `/ev-charging/:id/pay`). If the plug does not switch off the bill is still made and the answer carries a `warning` |

**Port controllers.** The QR only names the port, so it never changes. What switches the plug is the port's `provider` (`EvPort.provider` and `providerConfig`, set in the admin portal): `manual` records only; `webhook` POSTs JSON `{event: "ev.charging", action: "on"|"off", at, port: {id, name, deviceId}, sessionId, customerName}` to the configured address with an `X-UF-Signature` header (hex HMAC SHA-256 of the body with the secret) and expects a 2xx answer within 8 seconds. If switching on fails the session is cancelled (502, nothing billed). To add a vendor SDK such as Tuya Cloud, add a `PortController` in `src/modules/ev/ev.provider.ts` (and the same file in the admin server, `src/lib/ev-controller.ts`) and register it in `CONTROLLERS`.

## Chat

Registered customers can chat one to one or in groups (text only). Every route needs a signed-in customer. A chat is visible only to its members; anyone else gets 404.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/chat/rules` | User | `{bodyMax: 1000, groupMax: 50, groupNameMin: 2, groupNameMax: 40}` |
| GET | `/chat/people?q=` | User | customers whose mobile number starts with `q` (at least 5 digits, else `[]`), max 10, never yourself: `[{phone, name, avatar}]` |
| GET | `/chat/threads` | User | my chats, newest activity first: `{id, kind: direct|group, title, avatar, memberCount, lastMessage, lastFrom, lastMessageAt, lastSeen, unread}`. `lastSeen` is for your own last message: `true` once everyone else has opened the chat since, `false` before, `null` when the last message is not yours |
| GET | `/chat/unread` | User | `{unread}` total unread messages (for the badge on the Chat tab) |
| POST | `/chat/direct` | User | `{phone}` -> `{id}`. One chat per pair (opening again returns the same one). 404 if the number is not a registered customer, 400 for yourself |
| POST | `/chat/groups` | User | `{name (2-40), members?: [phone]}` -> `{id}`. The creator is the admin. 5 groups per 24 hours (429), up to 50 people |
| GET | `/chat/threads/:id` | Member | `{id, kind, title, avatar, members[{phone,name,avatar,role,you}], isAdmin, inviteCode}`. `inviteCode` only for a group admin |
| GET | `/chat/threads/:id/messages?after=` | Member | the latest 60 messages, or those after an ISO time. Marks the chat read. `[{id, senderId, senderName, body, createdAt, mine, deleted, replyTo}]` (`replyTo` is `{id, senderName, body (first 100 characters), deleted}` for a reply, else `null`); a deleted message has `body: ""` and `deleted: true` |
| GET | `/chat/threads/:id/status` | Member | `{reads: [ISO time each other member last opened the chat], deleted: [ids of recent deleted messages]}`. Does not mark the chat read. A message of yours is Seen when every time in `reads` is at or after its `createdAt` |
| DELETE | `/chat/threads/:id/messages/:messageId` | Sender | deletes your own message for everyone: the words are erased and a "deleted" note stays (403 for someone else's message, 404 if it is not in this chat). Deleting twice is harmless. If it was the latest message the chat preview becomes "This message was deleted"; deleted messages are not counted as unread |
| POST | `/chat/threads/:id/messages` | Member | `{body (1-1000), replyTo?}`. `replyTo` is the id of an earlier message in this same chat (404 otherwise). 20 messages a minute per customer (429). Every other member gets a Web Push alert (title: the sender, or the group name; body: the message; opens `/chat/<id>`) unless they read the chat in the last 10 seconds |
| PATCH | `/chat/threads/:id` | Group admin | `{name}` renames the group |
| POST | `/chat/threads/:id/members` | Group admin | `{phones: []}` adds registered customers (max 50 in a group) |
| DELETE | `/chat/threads/:id/members/:phone` | Admin, or yourself | remove a person, or leave. The group keeps an admin (longest member takes over); an empty group is deleted. One to one chats cannot be left |
| POST | `/chat/threads/:id/invite` | Group admin | new invite code; the old link stops working |
| GET | `/chat/invite/:code` | User | `{id, name, memberCount, alreadyIn, full}` preview of a group link |
| POST | `/chat/invite/:code/join` | User | joins the group -> `{id}` (400 if full) |
| GET | `/chat/friends` | User | `{friends[{id,phone,name,avatar}], incoming[{id,from,at}], outgoing[{id,to,at}]}` |
| POST | `/chat/friends/request` | User | `{phone}` -> `{id, status}`. 404 if not a registered customer, 400 for yourself, 409 if already friends or already sent, 429 after 20 requests in 24 hours. If they already asked you, you become friends (`status: accepted`). The other person gets a notice |
| POST | `/chat/friends/:id/accept` | Receiver | accepts a request sent to you (404 for anyone else). The sender gets a notice |
| DELETE | `/chat/friends/:id` | Either side | declines a request, cancels one you sent, or removes a friend |

## Find Player: "I need N players"

Any registered customer (the host) can ask for more players for a **friendly** game: up to **11** players, on a day from tomorrow, within the next **6** days (never today). Every other registered customer gets an in-app notice (type `players`, and a push to devices unless they switched promotional notifications off): "<name> needs 6 Players for Upcoming Game. View the deal" linking to `/find-player/<id>`. Every route needs a signed-in customer.

Money: the court price for that hour (taken when posted) is shared **equally** by everyone playing, the host included, whoever wins or loses, and paid at the venue. Once everyone has joined, the host pays an **advance of Rs. 300 online** (Fonepay QR) within 2 hours; that books the court, and the host's venue payment is their share minus the advance. If the advance is not paid in time the request is cancelled and the players are told.

Status: `open` -> `awaiting_advance` (everyone joined) -> `confirmed` (advance paid, court booked) | `cancelled`; `expired` is shown for a request whose start time has passed.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/player-requests/rules` | User | `{maxPlayers: 11, windowDays: 6, advanceFee: 300, perDay: 3, noteMax: 140, hours: [open start hours], ageGroups: ["open","15-20","20-25","25-30","30-35","35-40","40+"]}` |
| GET | `/player-requests` | User | open requests that have not started (and your own / ones you joined), soonest first: `{id, posterName, mine, date, hour, playersNeeded, joined, spotsLeft, note, status, joinedByMe, joiners?, courtPrice, everyone, sharePerPlayer, hostShare, advanceFee, hostPaysAtVenue, advanceDueAt, confirmed}`. `joiners` only for the host |
| POST | `/player-requests` | User | `{date, hour, players (1-11), note? (140), ageGroup? ("open" by default, or one of the age groups)}` -> `{id}`. An age-group request is notified only to registered customers whose age (from the date of birth) is in the group: a group is from its first age up to, not including, the next (20 is in 20-25; 40+ is 40 and over); Open goes to everyone. A day from tomorrow within the next 6 days (today is refused), an open hour. 3 requests per 24 hours (429); the same time twice is 409. Notifies everyone else |
| GET | `/player-requests/:id` | User | one request with the split above (404 when gone) |
| POST | `/player-requests/:id/join` | User | "I'm in". Age-group requests only for people in the group (403; "Add your date of birth in your Profile…" when they have none). Requests also show `ageGroup`, `eligible`, `needsDob`; a customer outside the group does not see the request in the list. The spots can never go below zero (transaction); 409 if already joined, 400 for your own, full, cancelled or started. The host is told. The last join moves it to `awaiting_advance` |
| POST | `/player-requests/:id/leave` | User | takes you out (not after the court is booked); an `awaiting_advance` request reopens |
| POST | `/player-requests/:id/advance` | Host | only when `awaiting_advance`: books the court for the hour (held for the QR) and returns the payment order `{orderCode, method: "fonepay", amount: 300, remarks, qrPayload, expiresAt, status}`. Poll `/payments/:orderCode/status`; when paid the booking is `confirmed` / `partially_paid` (Rs. 300 paid, the rest at the venue) and the request `confirmed`. Asking again returns the same QR |
| POST | `/player-requests/:id/cancel` | Host | cancels; the court booking is cancelled (an advance paid is marked for refund) and joiners are told (403 for anyone else) |

## Unique Club

Rs. 1,500 for 30 days. While a member is active, every court booking and Gamezone session gets **10% off**, and a hosted tournament gets 10% off its court charge (admin portal). A member **cannot use a promo code or a VIP code** on top: the club discount replaces them. The discount is recorded on the booking (`clubDiscount`) so the admin portal, receipts and the WhatsApp bill can show it. Renewing early adds 30 days on top of the days left; a reminder goes out 3 days before the end.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/club` | User | `{fee: 1500, days: 30, percent: 10, member, expired, validUntil, daysLeft, since, payments}` |
| POST | `/club/join` | User | starts (or renews) the club: returns the Fonepay QR order `{orderCode: "CLUB-XXXXXXXX", amount: 1500, qrPayload, expiresAt, ...}`. Poll `/payments/:orderCode/status`; when it is paid the club switches on. The same pending QR is returned if asked again |

Where the discount shows up:
- `POST /bookings/quote` returns `club: {percent, discount}` for a member (and `promo.ok = false` with a message if a promo code was typed); `POST /bookings/checkout` refuses a promo code from a member (400).
- Gamezone: the total is already 10% lower; the session row has `clubDiscount`.
- Admin portal: walk-in and bulk bookings for a member's number get 10% off (not when staff type a price); the booking, the Payments list, the final bill (CB-...), the WhatsApp invoice and a hosted tournament's bill show "Unique Club member discount". Payments > Unique Club lists the Rs. 1,500 payments.

**Maturity rule.** The 10% on the **1-month membership plan** and on **hosting a tournament** (admin portal) is only for a club member who has been in the club for **15 days, or has played 5 games** (completed bookings dated on or after the day they joined). Court bookings and Gamezone get the 10% from the first day. `GET /club` reports it: `{mature, daysIn, gamesPlayed, daysToMature, gamesToMature, matureAfterDays: 15, matureAfterGames: 5}`. The check is made by the server when a membership is requested and when the tournament bill is made (at the closing time once the final bill is closed).

## Unique Goal Rush (penalty game)

A 5-shot penalty game against a goalkeeper played by the **server**. The app sends only where the player aimed and how hard; the server decides the kick's accuracy, the keeper's dive and the result (`src/modules/goalrush/goalrush.sim.ts`), so editing the browser cannot change a result. A copy of the engine in the app (`lib/goalrush-sim.ts`) is used only for the guest/practice mode, which earns nothing.

Rules (enforced here): up to **3 games a calendar day** (Nepal time) for a signed-in customer; **every game started counts**, so a bad start cannot be thrown away. A game is exactly 5 shots, taken in order, at least 0.6 s apart. When the 5th shot is in, the game is finished and, **in the same transaction**, earns loyalty points **only with at least 3 goals out of 5: every 3 goals = 1 point** (so 1 point for 3, 4 or 5 goals; 0 for fewer): a `LoyaltyEntry` of kind `goal_rush` (sourceType `goal_rush`, sourceId = game id, unique), valid 3 months. At most 3 points a day. Sending a shot again returns the stored result (idempotent). A game left for 30 minutes, or from an earlier day, is abandoned: it counts for its day and earns nothing. Starts are serialised per customer (advisory lock), shots per game (row lock). Every finished game is written to the audit log.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/goal-rush/rules` | Public | `{shotsPerGame: 5, gamesPerDay: 3, goalsToQualify: 3, goalsPerPoint: 3, pointsPerGame: 1, maxPointsPerDay: 3}` |
| GET | `/goal-rush/me` | User | `{rules, allowance: {day, limit, used, left, pointsToday, maxPointsPerDay, resetsAt}, active: game or null, balance: valid loyalty points, recent: last 10 games}` |
| POST | `/goal-rush/games` | User | starts a game (201) or returns the one still being played (200, `resumed: true`). 429 when the 3 games of the day are used |
| GET | `/goal-rush/games/:id` | Owner | the game with its shots |
| POST | `/goal-rush/games/:id/shots` | Owner | `{no (1-5), aimX, aimY, power (0-1)}` -> `{shot: {no, outcome: goal/save/wide/over/post, ballX, ballY, keeper}, game, allowance}`. 409 out of order or over, 429 too fast, 404 not yours. After shot 5 the game has `status: "completed"`, `points` and `rewardId` |
| GET | `/goal-rush/history` | User | finished and abandoned games, newest first |

Admin portal: `GET /admin/goal-rush` (totals for today, this month and all time, games per day for 14 days, players worth a look, the games list) and `GET /admin/goal-rush/:id` (one game shot by shot with its reward reference); permission `goalrush.view`. Nothing can be edited there; a reward is corrected with Loyalty Points > Adjust, which is logged.

## Watch & Earn (ads for loyalty points)

The customer taps **View Ads** and keeps watching ads one after another. **1 ad = 15 seconds; 40 ads (10 minutes) = 1 loyalty point.** The **server** times every ad: `POST /watch-earn/views` opens a view and `POST /watch-earn/views/:id/complete` only counts it when at least 15 seconds (less a 1 second allowance for the network) have passed since the start, so the app cannot count an ad early. Only one view is open per customer (starting the next closes the old one; advisory lock per customer), so the fastest possible rate is one counted ad every 15 seconds. A view not completed within 5 minutes is abandoned (also swept by the ten-minute job). Completing twice counts once (row lock). The point is written **in the same transaction as the 40th, 80th, ... counted ad**: a `LoyaltyEntry` of kind `watch_earn` (sourceType `watch_earn`, sourceId `<phone>:<block>`, unique), valid 1 year, with a "Points earned" notice and an audit row (`WATCH_EARN_POINT`). Tables: `WatchEarnView`, `WatchEarnStat`. The ads shown are the live ads of Site Content (the app picks them from `GET /content/active`); the server records only the ad id. There is no daily cap in the rules given.

| Method | Path | Who | What |
| --- | --- | --- | --- |
| GET | `/watch-earn/rules` | Public | `{adSeconds: 15, adsPerPoint: 40, pointsPerBlock: 1, minutesPerPoint: 10}` |
| GET | `/watch-earn/me` | User | `{rules, totalViews, pointsEarned, adsTowardNext, adsLeftForNext, todayViews, balance}` |
| POST | `/watch-earn/views` | User | `{adId?}` -> 201 `{viewId, seconds: 15, startedAt}`; closes any view still open |
| POST | `/watch-earn/views/:id/complete` | Owner | counts the ad -> `{counted, earnedNow (0 or 1), ...me}`. 409 too early / closed / timed out, 404 not yours |

## Order at the venue (venue orders)

Drinks and snacks (Mineral Water Bottle, Frooty...) ordered from the app during a booked game. Only a registered customer, and only the account that booked the game that is on (from its start time to its end time, a game past midnight counts). Products appear only when staff switch on "Show to Order list in client side" in the admin Inventory page (`Product.orderable`). An order is stored as a pay-later due (`GoodsSale` with the booking id plus a `GoodsDue`, created by `app:<phone>`), the stock goes down at once, and the admin bell shows it with a siren. Staff collect it in Payments and the final bill like any goods due.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/venue-orders/current` | User | `{active, next, limits:{perItem, perOrder}, items:[{id,name,price,unit,left}]}`. `active` is the customer's own confirmed game that is on now (items are empty without one); `next` is their next game |
| POST | `/venue-orders` | User | `{items:[{productId, quantity}]}` -> `{id, items, total, game}`. 403 outside the game or for someone who did not book it, 404 for a product not switched on, 409 when stock is short, 400 for more than 6 of one item or 10 items in all, 429 after 5 orders for one game |
