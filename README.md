# Ababeel Gateway

Build a modern, mobile-first web application named “Ababeel Quran Class” for managing Quran class admissions, students, staff, announcements, and competitions.

Use a clean Islamic educational design with soft sky-blue, white, and subtle gold accents. The website must be fully responsive for mobile, tablet, and desktop.

1. User Roles

Create three system roles:

Admin

Staff

Student

Each role must have separate permissions and dashboards.

2. Authentication and Login URLs

Landing Page

The public landing page must show only the Student Login option.

Do not show Admin Login or Staff Login buttons, links, or navigation items on the public landing page.

Hidden Login Pages

Admin and staff must log in using direct URLs:

Admin login: /admin

Staff login: /staff

Student login: /student-login

After successful login, redirect users according to their role:

Admin → /admin/dashboard

Staff → /staff/dashboard

Student → /student/dashboard

Prevent users from accessing dashboards that do not match their assigned role.

Student Login

Student login should use:

Username

Numeric PIN

The PIN field must accept numbers only.

Add:

Show/hide PIN option

Login validation

Account inactive message

Incorrect username or PIN message

Logout option

3. Public Landing Page

Create a professional public landing page with the following sections:

Header

Ababeel Quran Class logo

Home

About

Admission

Competitions

Announcements

Contact

Student Login button

Hero Section

Include:

Quran class title

Short welcoming message

Admission button

View competitions button

Student login button

Admission Announcement

Show whether admission is:

Open

Closed

Opening soon

Display the admission opening and closing dates.

Active Competitions

Show competition announcements that are active within their configured display date range.

Each competition card should show:

Competition title

Short description

Category information

Competition date

Registration closing date

Participate button

Read Rules button

Do not show competitions before their announcement start date or after their announcement end date.

General Announcements

Display published announcements from the admin panel.

Footer

Include:

Class name

Contact number

Email

Address

Social media links

Copyright notice

4. Admission Management

Admission Settings

Admin can configure:

Admission status: Open or Closed

Admission announcement title

Admission description

Application opening date

Application closing date

Admission rules

Required form fields

Maximum age and minimum age, if applicable

Success message after submission

Admission rules must be displayed before the application form.

Public Admission Form

The form should include:

Student full name

Date of birth

Gender

ID card or birth certificate number

Parent or guardian name

Parent or guardian ID number

Mobile number

Alternative mobile number

Address

Island

Atoll

Previous Quran learning experience

Current Quran reading level

Preferred class

Preferred session

Medical or special support notes

Additional remarks

Optional student photo upload

Optional ID or birth certificate upload

Before submission, show the complete admission rules.

Add a required checkbox:

“I have read and agree to the admission rules.”

The Submit Application button must remain disabled until the applicant agrees to the rules.

The form must not allow submission when:

Admission is closed

The application date is outside the configured opening and closing dates

Required fields are incomplete

The applicant has not agreed to the rules

After submission:

Generate a unique admission request number

Show a success confirmation

Save the request in the admin panel

Set initial status as Pending

Duplicate Protection

Prevent duplicate admission requests using one or more of these:

Student ID or birth certificate number

Parent mobile number

Student name and date of birth

Show a clear message when a possible duplicate is found.

5. Admin Admission Requests

Create an Admin Panel section called Admission Requests.

Display requests in a searchable table.

Columns:

Request number

Student name

Date of birth

Gender

Parent or guardian

Mobile number

Preferred class

Submission date

Status

Actions

Admission statuses:

Pending

Under Review

Approved

Rejected

Waiting List

Admin actions:

View full application

Edit request

Add internal notes

Approve

Reject

Move to waiting list

Delete

Download uploaded files

Print application

Export requests to CSV

Add filters for:

Status

Class

Gender

Age

Application date

Island

Atoll

Approving an Admission

When an admission request is approved:

Automatically create a student profile.

Automatically create a student login account.

Generate a unique username.

Generate a temporary numeric PIN.

Link the user account to the student profile.

Change the admission request status to Approved.

Show the generated username and PIN to the admin.

Allow admin to edit the username and PIN before sharing them with the student.

Prevent creating duplicate student profiles from the same request.

Admin should be able to copy or print the student login credentials.

6. Admin Panel

Create a secure Admin Panel with a sidebar.

Admin Dashboard

Show summary cards:

Total students

Active students

Inactive students

Total staff

Pending admission requests

Approved admission requests

Active competitions

Pending competition participants

Today’s attendance

Recent announcements

Also include:

Recent admission requests

Upcoming competitions

Recent participant registrations

Quick action buttons

Admin Modules

Include:

Dashboard

Admission Management

Admission Requests

Student Management

Staff Management

User Management

Classes

Attendance

Competitions

Competition Participants

Announcements

Reports

Website Settings

System Settings

Audit Log

7. Student Management

Create a student directory with:

Student ID

Full name

Photo

Date of birth

Gender

Parent or guardian

Contact number

Address

Class

Session

Admission date

Status

Username

Account status

Student statuses:

Active

Inactive

Graduated

Suspended

Left

Admin can:

Add student manually

Edit student

View profile

Activate or deactivate student

Move student to another class

Reset numeric PIN

Edit username

Print student profile

View attendance

View competition participation

View results

Archive student

8. User Management

Create separate tabs:

Student Users

Staff Users

Admin Users

Student User Tab

Show:

Student name

Student ID

Username

Numeric PIN reset option

Linked class

Account status

Last login

Actions

Admin can:

Edit username

Set or reset numeric PIN

Activate account

Deactivate account

Lock account

Unlock account

View linked student profile

The PIN must:

Be numeric only

Have a configurable minimum length

Be securely stored

Never be displayed openly after initial creation or reset

Staff User Tab

Admin can:

Create staff user

Assign staff role

Set username

Set temporary password or numeric PIN

Activate or deactivate account

Assign classes

Reset credentials

9. Staff Panel

Staff login must only be available through /staff.

Create a Staff Dashboard with:

Assigned classes

Student count

Today’s attendance

Upcoming competitions

Recent announcements

Pending staff tasks

Staff permissions should be configurable by the admin.

Possible staff permissions:

View assigned students

Mark attendance

View student profiles

Add student remarks

View competitions

Review competition participants

Record competition results

Publish class announcements

View reports

Staff must not access:

Admin user management

System settings

Financial information

Other restricted admin modules

10. Student Panel

Create a student-friendly dashboard.

Show:

Student name and photo

Student ID

Class

Session

Teacher

Attendance summary

Upcoming competitions

Competition registrations

Competition results

Announcements

Learning progress

Profile details

Student actions:

View profile

View attendance

View class information

View announcements

View active competitions

Register for competitions

Read competition rules

View registration approval status

Change PIN

Logout

Students must only see their own records.

11. Competition Management

Create a complete Competition Management module.

Create Competition

Admin can configure:

Competition title

Competition code

Short description

Full description

Competition image or banner

Competition type

Location

Competition date

Start time

End time

Registration opening date

Registration closing date

Announcement display start date

Announcement display end date

Eligible age range

Eligible gender

Eligible classes

Maximum participants

Whether public registration is enabled

Whether student login registration is enabled

Participant approval required

Competition rules

Contact information

Competition status

Competition statuses:

Draft

Published

Registration Open

Registration Closed

Completed

Cancelled

Archived

Competition Categories

Admin can create multiple categories for each competition.

Each category can include:

Category name

Category code

Description

Age limit

Gender eligibility

Eligible classes

Maximum participants

Registration fee, if used

Rules specific to the category

Examples:

Quran Recitation

Hifz

Amma Foy

Tajweed

Adhan

Islamic Quiz

Landing Page Competition Announcement

A published competition must appear on the landing page only during its selected announcement display date range.

The announcement should include:

Competition title

Banner

Description

Date

Registration closing date

Available categories

Participate button

Read Rules button

The Read Rules button should open a modal or separate page containing:

General competition rules

Category-specific rules

Eligibility information

Important dates

12. Public Competition Participation Form

Allow public users to participate from the landing page when public registration is enabled.

Form fields:

Participant full name

Date of birth

Gender

ID card or birth certificate number

Parent or guardian name

Mobile number

Address

Island

Atoll

School or class

Selected competition

Selected category

Previous competition experience

Additional notes

Optional photo upload

Optional document upload

Before submission, display all competition rules.

Add a required checkbox:

“I have read and agree to the competition rules.”

Disable the Submit Participation Request button until the checkbox is selected.

Validate eligibility based on:

Age

Gender

Class

Category

Registration dates

Maximum participant limit

After submission:

Generate a participant registration number

Set status to Pending

Show confirmation message

Save the request in the Admin Panel

Prevent duplicate participation in the same competition and category using the participant’s ID number.

13. Student Competition Registration

Logged-in students should be able to register without re-entering information already saved in their profile.

Auto-fill:

Student name

Date of birth

Gender

ID number

Parent information

Contact number

Address

Class

The student selects:

Competition

Category

Optional notes

The student must read and agree to the competition rules before submitting.

14. Competition Participants Management

Create a page called Competition Participants.

Display:

Registration number

Participant name

Student or public participant

Age

Gender

Competition

Category

Contact number

Registration date

Approval status

Participation status

Actions

Approval statuses:

Pending

Approved

Rejected

Waiting List

Participation statuses:

Registered

Checked In

Participated

Absent

Disqualified

Completed

Admin and authorized staff can:

View registration

Approve

Reject

Move to waiting list

Edit participant

Change category

Add internal notes

Mark check-in

Mark attendance

Record result

Print participant list

Export CSV

Add filters for:

Competition

Category

Approval status

Participation status

Gender

Age group

Student or public participant

Registration date

Include category-wise participant counts.

15. Competition Results

Allow admin or authorized staff to record:

Rank

Score

Grade

Judge remarks

Result status

Certificate number

Prize details

Result statuses:

Pending

Qualified

Winner

Runner-up

Participated

Disqualified

Students should see only their own results.

Admin can publish or hide results.

16. Classes

Admin can manage:

Class name

Class code

Teacher

Assistant teacher

Session

Room

Maximum students

Status

Suggested classes:

Baby Class

Nursery

LKG

UKG

Hifz

Amma Foy

Hathim

Fili Kalima

Key Stage 1

Key Stage 2 and 3

Admin can assign students and staff to classes.

17. Attendance

Staff can mark attendance for assigned classes.

Attendance statuses:

Present

Absent

Sick

Excused

Late

Include:

Date selector

Class selector

Student list

Bulk marking

Notes

Duplicate attendance protection

Students can see their own attendance summary.

Admin can generate monthly and yearly attendance reports.

18. Announcements

Admin can create announcements for:

Public landing page

All students

Selected class

Staff only

Competition participants

Selected users

Announcement fields:

Title

Description

Image

Audience

Publish date

Expiry date

Priority

Status

Priority options:

Normal

Important

Urgent

Only active announcements within the configured date range should appear.

19. Rules Management

Create a Rules Management area with separate sections:

Admission Rules

General Competition Rules

Category-Specific Competition Rules

Student Rules

Class Rules

Admin can:

Create rules

Edit rules

Arrange rule order

Publish or unpublish rules

Add numbered points

Add headings

Add downloadable documents

Record the rule version agreed to by each applicant or participant.

Save:

Rule version

Agreement date

Applicant or participant

IP or session reference when available

20. Reports

Create reports for:

Admission requests

Approved admissions

Rejected admissions

Active students

Inactive students

Student users

Attendance

Competition registrations

Competition participants by category

Approved and rejected participants

Competition results

Class-wise student lists

Add:

Date filters

Class filters

Category filters

Status filters

Print

CSV export

PDF-ready layout

21. Website Settings

Admin can update:

Website name

Logo

Favicon

Hero title

Hero description

Contact number

Email

Address

Social media links

Landing page images

About section

Footer text

Theme preferences

Student PIN minimum length

22. Database Structure

Create suitable database tables such as:

profiles

id

user_id

full_name

role

phone

photo_url

account_status

created_at

updated_at

students

id

admission_request_id

student_number

full_name

date_of_birth

gender

identity_number

guardian_name

guardian_identity_number

mobile

alternative_mobile

address

island

atoll

class_id

session

admission_date

status

photo_url

created_at

updated_at

student_accounts

id

student_id

user_id

username

pin_hash

is_active

is_locked

last_login

created_at

updated_at

staff

id

user_id

staff_number

full_name

designation

phone

assigned_classes

status

created_at

updated_at

admission_settings

id

title

description

rules

rules_version

opening_date

closing_date

is_open

success_message

created_at

updated_at

admission_requests

id

request_number

full_name

date_of_birth

gender

identity_number

guardian_name

guardian_identity_number

mobile

alternative_mobile

address

island

atoll

previous_experience

reading_level

preferred_class

preferred_session

medical_notes

remarks

photo_url

document_url

agreed_to_rules

rules_version

status

admin_notes

submitted_at

reviewed_at

reviewed_by

competitions

id

competition_code

title

short_description

full_description

banner_url

competition_type

location

competition_date

start_time

end_time

registration_open_date

registration_close_date

display_start_date

display_end_date

minimum_age

maximum_age

eligible_gender

eligible_classes

maximum_participants

public_registration_enabled

student_registration_enabled

approval_required

rules

rules_version

status

created_at

updated_at

competition_categories

id

competition_id

category_code

category_name

description

minimum_age

maximum_age

eligible_gender

eligible_classes

maximum_participants

category_rules

status

competition_participants

id

registration_number

competition_id

category_id

student_id

participant_type

full_name

date_of_birth

gender

identity_number

guardian_name

mobile

address

island

atoll

school_or_class

experience

notes

photo_url

document_url

agreed_to_rules

rules_version

approval_status

participation_status

admin_notes

submitted_at

reviewed_at

reviewed_by

competition_results

id

competition_id

category_id

participant_id

rank

score

grade

judge_remarks

result_status

certificate_number

prize_details

is_published

created_at

updated_at

classes

id

class_code

class_name

teacher_id

assistant_teacher_id

session

room

maximum_students

status

attendance

id

student_id

class_id

attendance_date

status

notes

recorded_by

created_at

announcements

id

title

description

image_url

audience

audience_reference

priority

publish_date

expiry_date

status

created_by

created_at

updated_at

audit_logs

id

user_id

action

module

record_id

previous_data

new_data

created_at

23. Security

Use secure role-based access control.

Requirements:

Public users can only access published public information and public forms.

Students can only access their own records.

Staff can only access assigned modules and classes.

Admin has full access.

Securely hash student PINs.

Do not store PINs as plain text.

Add row-level security policies.

Validate all forms on the frontend and backend.

Restrict uploaded file types and file sizes.

Record important actions in the audit log.

Protect /admin and /staff routes.

Do not expose admin or staff navigation on the public website.

24. User Interface Requirements

Use:

Mobile-first responsive layout

Large readable text

Clean cards

Rounded corners

Clear status badges

Searchable tables

Filter drawers on mobile

Confirmation dialogs for approve, reject, deactivate, and delete actions

Loading indicators

Empty-state messages

Success and error notifications

Pagination for long lists

Use colors consistently:

Pending: amber

Approved: green

Rejected: red

Waiting List: blue

Inactive: gray

Urgent: red

25. Important Workflow Requirements

Admission Approval Workflow

Public application
→ Pending admission request
→ Admin reviews
→ Admin approves
→ Student profile created automatically
→ Student login account created automatically
→ Username and temporary numeric PIN generated
→ Admin can edit credentials
→ Student account can be activated or deactivated

Competition Workflow

Admin creates competition
→ Adds categories and rules
→ Publishes competition
→ Competition appears on landing page during the selected display date range
→ Participant reads and agrees to rules
→ Registration submitted
→ Request appears in Competition Participants
→ Admin or authorized staff approves or rejects
→ Approved participant joins participant list
→ Result can be recorded and published

Build the complete working application with real database integration, authentication, role-based permissions, responsive pages, forms, validation, filters, user management, and approval workflows. Do not use placeholder-only buttons. All primary actions must work and save data correctly.

This specification can also be divided into smaller Lovable prompts module by module if the first generation becomes too large.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/62214b1f-eaad-465f-8209-b0091a6190f9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
