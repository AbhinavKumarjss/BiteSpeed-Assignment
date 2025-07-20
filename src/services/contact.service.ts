import { getDbClient } from '../database';
import { Contact, IdentifyRequest, ConsolidatedContact } from '../types/contact.types';

export const identifyContact = async (payload: IdentifyRequest): Promise<ConsolidatedContact> => {
  const { email, phoneNumber } = payload;
  const client = getDbClient();
  await client.connect();

  try {
    const findQuery = `
      SELECT * FROM "Contact"
      WHERE (email = $1 AND $1 IS NOT NULL) OR ("phoneNumber" = $2 AND $2 IS NOT NULL)
      ORDER BY "createdAt" ASC;
    `;
    const { rows: matchingContacts } = await client.query<Contact>(findQuery, [email, phoneNumber]);

    if (matchingContacts.length === 0) {
      const insertQuery = `
        INSERT INTO "Contact" (email, "phoneNumber", "linkPrecedence")
        VALUES ($1, $2, 'primary')
        RETURNING *;
      `;
      const { rows: [newContact] } = await client.query<Contact>(insertQuery, [email, phoneNumber]);
      
      return {
        primaryContatctId: newContact.id,
        emails: [newContact.email].filter(Boolean) as string[],
        phoneNumbers: [newContact.phoneNumber].filter(Boolean) as string[],
        secondaryContactIds: [],
      };
    }

    let primaryContact = matchingContacts.find(c => c.linkPrecedence === 'primary')!;
    const secondaryContacts = matchingContacts.filter(c => c.linkPrecedence === 'secondary');

    if (!primaryContact) {
      const { rows: [foundPrimary] } = await client.query<Contact>(
        'SELECT * FROM "Contact" WHERE id = $1', [secondaryContacts[0].linkedId]
      );
      primaryContact = foundPrimary;
    }

    const primaryContactsInSet = new Set(matchingContacts.map(c => c.linkPrecedence === 'primary' ? c.id : c.linkedId).filter(Boolean));
    if (primaryContactsInSet.size > 1) {
        const primaryIds = Array.from(primaryContactsInSet) as number[];
        const { rows: allPrimaries } = await client.query<Contact>('SELECT * FROM "Contact" WHERE id = ANY($1::int[]) ORDER BY "createdAt" ASC', [primaryIds]);
        
        primaryContact = allPrimaries[0];
        const contactToDemote = allPrimaries[1];

        await client.query(
            'UPDATE "Contact" SET "linkedId" = $1, "linkPrecedence" = \'secondary\', "updatedAt" = NOW() WHERE "linkedId" = $2 OR id = $2',
            [primaryContact.id, contactToDemote.id]
        );
    }
    
    const emailExists = matchingContacts.some(c => c.email === email);
    const phoneExists = matchingContacts.some(c => c.phoneNumber === phoneNumber);
    
    if ((email && !emailExists) || (phoneNumber && !phoneExists)) {
      const insertQuery = `
        INSERT INTO "Contact" (email, "phoneNumber", "linkedId", "linkPrecedence")
        VALUES ($1, $2, $3, 'secondary')
        RETURNING *;
      `;
      await client.query<Contact>(insertQuery, [email, phoneNumber, primaryContact.id]);
    }

    const consolidationQuery = `
      SELECT * FROM "Contact"
      WHERE id = $1 OR "linkedId" = $1
      ORDER BY "createdAt" ASC;
    `;
    const { rows: allLinkedContacts } = await client.query<Contact>(consolidationQuery, [primaryContact.id]);
    
    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();
    const secondaryContactIds: number[] = [];

    if (primaryContact.email) emails.add(primaryContact.email);
    if (primaryContact.phoneNumber) phoneNumbers.add(primaryContact.phoneNumber);

    allLinkedContacts.forEach(contact => {
        if (contact.email) emails.add(contact.email);
        if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
        if (contact.id !== primaryContact.id) {
            secondaryContactIds.push(contact.id);
        }
    });

    return {
      primaryContatctId: primaryContact.id,
      emails: Array.from(emails),
      phoneNumbers: Array.from(phoneNumbers),
      secondaryContactIds,
    };

  } catch (error) {
    console.error("Error in identifyContact service:", error);
    throw error;
  } finally {
    await client.end();
  }
};