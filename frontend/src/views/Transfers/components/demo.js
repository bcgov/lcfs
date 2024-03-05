export const demoData = {
  id: 1178,
  status: 'Submitted',
  FromOrganization: 'Fuel Supplier Canada Ltd.',
  ToOrganization: 'Fantastic Fuels Co.',
  noOfComplianceUnits: '100',
  valuePerUnit: '400',
  comments: [
    {
      commentID: 1,
      firstName: 'Buzz',
      lastName: 'Collins',
      addDate: 'May 2, 2023',
      organization: 'Fuel Supplier Canada Ltd.',
      message: 'This is to record our signed contract: CT20230415001'
    },
    {
      commentID: 2,
      firstName: 'Jam',
      lastName: 'Tracker',
      addDate: 'May 4, 2023',
      organization: 'Government of BC',
      message: 'Contract has been verified and approved.'
    }
  ],
  attachments: [
    {
      attachmentID: 1,
      fileName: 'Contract.pdf',
      fileSize: '2.5MB',
      uploadedBy: 'Buzz Collins',
      uploadedDate: 'May 2, 2023',
      link: '#'
    },
    {
      attachmentID: 2,
      fileName: 'CT20230415001-Agreement.msg',
      fileSize: '4MB',
      uploadedBy: 'Buzz Collins',
      uploadedDate: 'May 2, 2023',
      link: '#'
    }
  ],
  transactionHistory: [
    {
      transactionID: 1,
      transactionDate: 'May 2, 2023',
      notes: "Date of written agreement reached between the two organizations: April 15, 2023 (proposal falls under Category B if approved by: April 15, 2024)"
    },
    {
      transactionID: 2,
      transactionDate: 'May 2, 2023',
      notes: "Signed and sent on May 2, 2023 by Buzz Collins of Fuel Supplier Canada Ltd. "
    }
  ]
}