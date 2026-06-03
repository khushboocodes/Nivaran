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

## Officer
```
email: officer.public@demo.nivaran.in
password: Officer@2026
```

> Admins always see every complaint regardless of department. If you want the
> admin (or an officer) to act on department-scoped complaints, assign them to
> a department in Prisma Studio (`npm --prefix server run prisma:studio`).

## Re-seeding

Run `npm --prefix server run db:seed` from the project root. It is idempotent:
existing accounts are left alone and their passwords are not reset.

## Safety

These credentials are for the prototype only. Rotate or remove them before
any real public deployment.
