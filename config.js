/*
 * ------------------------------------------------------------------
 *  SITE SETTINGS — edit this file to change your details.
 *  No coding needed: just change the text between the quotes.
 * ------------------------------------------------------------------
 */
window.SITE_CONFIG = {
  // About you
  doctorName: "Dr. Viraj Bafna",
  qualification: "1st year MBBS",
  role: "Medical student",
  tagline: "Caring, evidence-based treatment for you and your family.",
  about:
    "I am a first-year MBBS student with a passion for preventive health and clear, honest health information. " +
    "Through this blog I share what I am learning in plain language, to help you understand your health better.",
  registrationNo: "Reg. No. — add your medical council number",

  // Clinic
  clinicName: "Viraj Health Clinic",
  address: "Add your clinic address here",
  phone: "+91 98765 43210",
  email: "clinic@example.com",
  hoursText: "Saturday – Sunday: 1:00 pm – 10:00 pm · Monday – Friday closed",
  mapLink: "", // optional Google Maps link

  // Booking
  slots: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
          "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"],
  closedDays: [1, 2, 3, 4, 5],      // 0 = Sunday, 1 = Monday ... 6 = Saturday
  maxDaysAhead: 30,     // how far ahead patients can book

  // Services shown on the home page
  services: [
    { title: "General consultation", text: "Fever, cough, cold, body pain, stomach problems and everyday illnesses." },
    { title: "Diabetes & blood pressure", text: "Diagnosis, regular monitoring and long-term management plans." },
    { title: "Health check-ups", text: "Routine and pre-employment check-ups with clear reports and advice." },
    { title: "Infections", text: "Viral fevers, dengue, typhoid, urinary and skin infections." },
    { title: "Vaccinations", text: "Adult vaccinations and guidance on travel and seasonal vaccines." },
    { title: "Lifestyle advice", text: "Diet, weight, sleep and stress — practical plans that work." }
  ],

  // ---------------------------------------------------------------
  //  DATABASE (optional but needed for real patient bookings)
  //  Leave blank = demo mode: data is saved only in this browser.
  //  Fill these in after following README "Go live" steps.
  // ---------------------------------------------------------------
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Demo-mode dashboard PIN (only used when Supabase is not set up)
  demoPin: "1234"
};
