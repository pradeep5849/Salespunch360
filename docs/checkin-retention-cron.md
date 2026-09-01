# Six-month check-in retention cron

Configure `DATABASE_URL`, `STORAGE_DRIVER=hostinger`, and an absolute private `HOSTINGER_STORAGE_PATH` outside `public_html`. In Hostinger Cron Jobs, run this command once daily from the application directory:

```sh
npm run cleanup:checkins
```

The command removes visits older than six calendar months in batches of 200, queues both private photo objects transactionally, and retries failed object deletions. It is idempotent and never deletes Customers or Leads.
