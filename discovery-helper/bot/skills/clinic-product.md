---
description: Use when no product brief is saved yet and the interviewer has not named a different product. Describes the clinic app in this repository.
---

# Clinic product

This is the product in the current repository: Spring Petclinic, packaged here as JF-Exercise. It is a veterinary clinic management web app for staff. These are facts about the software, not research findings.

## What it does

- Home welcome page.
- Find owners by last name, then open an owner.
- Create and edit an owner: first name, last name, address, city, telephone.
- Add and edit a pet on an owner: name, birth date, type.
- Add a visit on a pet: date and a free-text description.
- List veterinarians and their specialties.

## Who it is for

The people who operate it are clinic staff. A typical split to test in discovery, not a finding:

- Front desk: find the owner, register someone new, add a pet, record a visit.
- Veterinarian: read the visit description later.
- Practice manager: cares whether the record is complete and the day stays on track.

Pet owners are customers in the domain. They do not sign in to this app. There is no login.

## The staff workflow

1. Search owners by last name.
2. Open the owner and scan pets and visits.
3. Add the owner if the search misses.
4. Add or correct the pet.
5. Add a visit with a date and a description.

## What the software does not do

Do not tell the interviewer these are user needs. Confirm them in sessions.

- The visit form has no veterinarian field and no schedule.
- The vet list is a directory of specialties, not availability.
- There is no owner-facing portal, payment, reminder, or medical record beyond the visit description.

## Saving the brief

When this is the product under study, save it with `save_discovery` kind `product_brief` before drafting a guide. If the interviewer names a different product, save that instead and do not overwrite it later unless they ask.
