import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();
const db = admin.firestore();

// Configure the email transport using environment variables
// To set these, use: firebase functions:config:set gmail.email="myemail@gmail.com" gmail.password="app-password"
// In Firebase Functions v2, consider using Secret Manager.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL || functions.config().gmail?.email,
    pass: process.env.GMAIL_PASSWORD || functions.config().gmail?.password,
  },
});

/**
 * Scheduled function to run every day at 9 AM to check for upcoming rent due dates.
 * Reminds tenants on the 28th of every month.
 */
export const rentDueReminder = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    try {
      const today = new Date();
      
      // Example: Send reminder if today is the 28th of the month
      if (today.getDate() === 28) {
        // In a real app, you might query a "leases" or "users" collection
        // Here we query "users" where role is "tenant"
        const tenantsSnapshot = await db.collection("users").where("role", "==", "tenant").get();
        
        const emailPromises = tenantsSnapshot.docs.map(async (doc) => {
          const tenant = doc.data();
          if (tenant.email) {
            const mailOptions = {
              from: "Property Management <no-reply@propertyflow.com>",
              to: tenant.email,
              subject: "Upcoming Rent Reminder",
              text: `Hello ${tenant.name || "Tenant"},\n\nThis is a friendly reminder that your rent is due on the 1st of the upcoming month.\n\nPlease log in to the Tenant Portal to view your balance and make your payment.\n\nThank you,\nProperty Management`,
            };
            return transporter.sendMail(mailOptions).catch((err) => console.error("Failed to send email to", tenant.email, err));
          }
        });
        
        await Promise.all(emailPromises);
        console.log(`Sent rent reminders to ${emailPromises.length} tenants.`);
      }
      return null;
    } catch (error) {
      console.error("Error sending rent reminders:", error);
      return null;
    }
  });

/**
 * Firestore trigger that sends an email when a maintenance request status is updated.
 */
export const maintenanceStatusUpdate = functions.firestore
  .document("maintenance_requests/{requestId}")
  .onUpdate(async (change, context) => {
    const previousData = change.before.data();
    const newData = change.after.data();

    // Only send email if the status has actually changed
    if (previousData.status === newData.status) {
      return null;
    }

    try {
      // Fetch the tenant's email using the tenantId stored on the request
      const tenantId = newData.tenantId;
      if (!tenantId) {
        console.log("No tenantId on maintenance request, skipping email.");
        return null;
      }

      // We need to look up the user document to get their email address
      // Assuming users are stored in the "users" collection and the doc ID is the uid
      const tenantDoc = await db.collection("users").doc(tenantId).get();
      if (!tenantDoc.exists) {
         // Also check if we stored it differently, but fallback for now
         console.log(`Tenant ${tenantId} not found in users collection.`);
         return null;
      }

      const tenant = tenantDoc.data();
      if (!tenant?.email) {
         console.log(`Tenant ${tenantId} has no email address.`);
         return null;
      }

      const statusLabels: Record<string, string> = {
        'pending': 'Open',
        'in_progress': 'In Progress',
        'resolved': 'Completed'
      };
      
      const newStatusLabel = statusLabels[newData.status] || newData.status;

      const mailOptions = {
        from: "Property Management <no-reply@propertyflow.com>",
        to: tenant.email,
        subject: `Update on your maintenance request: ${newData.title}`,
        text: `Hello ${tenant.name || "Tenant"},\n\nThe status of your maintenance request "${newData.title}" has been updated.\n\nNew Status: ${newStatusLabel}\n\nYou can view more details and track the progress in your Tenant Portal.\n\nThank you,\nProperty Management`,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Sent maintenance update email to ${tenant.email}`);
      return null;
    } catch (error) {
      console.error("Error sending maintenance update email:", error);
      return null;
    }
  });
