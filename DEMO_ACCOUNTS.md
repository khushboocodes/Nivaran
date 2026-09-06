# Demo accounts

These accounts are seeded for the NIVARAN prototype so testers can sign in
without going through the signup flow.

## Citizen

```
email:    citizen@demo.nivaran.in
password: Citizen@2026
```

## Admin

```
email:    admin@demo.nivaran.in
password: Admin@2026
```

## Departmental officers

One officer per department, each confined to their own department everywhere in
the admin console. Signing in as two different officers is the quickest way to
see the department firewall working.

```
password for all officers: Officer@2026

officer.water@demo.nivaran.in          Water Supply Board
officer.electricity@demo.nivaran.in    Electricity Department
officer.works@demo.nivaran.in          Public Works Department
officer.sanitation@demo.nivaran.in     Sanitation Department
officer.health@demo.nivaran.in         Healthcare Department
officer.municipal@demo.nivaran.in      Municipal Corporation
```

Create them with `npm --prefix server run seed:staff`.

> An **admin** sees every department and can narrow the view with the sidebar
> department selector. An **officer** is pinned to their own department: the
> `dept` parameter is ignored for them server-side, so they cannot widen their
> scope, and an officer with no department assigned is shown nothing rather than
> everything.

## Re-seeding

Run `npm --prefix server run db:seed` for the citizen and admin accounts, and
`npm --prefix server run seed:staff` for the departmental officers. Both are
idempotent: existing accounts keep their passwords, and `seed:staff` only fills
in a department where one is missing.

## Safety

These credentials are for the prototype only. Rotate or remove them before
any real public deployment.
