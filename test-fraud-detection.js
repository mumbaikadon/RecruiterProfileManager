const { clientNames, relevantDates } = {
  clientNames: [
    "Velocity",
    "HMS",
    "FIS",
    "FIS, Irving, TX",
    "AT&T Houston, TX"
  ],
  relevantDates: [
    "Feb 2023- Present",
    "Sep 2022– Feb 2023",
    "July 2020 – Aug 2022",
    "May 2018 – July 2020",
    "Feb 2017 – Apr 2018"
  ]
};

// Make an API call to check for similar employment histories
fetch('/api/candidates/check-similar-employment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    candidateId: 0, // Not needed for testing
    clientNames,
    relevantDates
  })
})
.then(response => response.json())
.then(data => {
  console.log('=== FRAUD DETECTION API RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Error testing fraud detection:', error);
});
