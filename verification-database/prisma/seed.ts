import 'dotenv/config';
import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

const companyPrefixes = [
  'Suryodaya', 'Bluehaven', 'Nimble', 'Kaveri', 'Aster', 'Northstar', 'Pragati',
  'Vistara', 'Cedar', 'Rivermark', 'Brightforge', 'Indigo', 'Meadowlink', 'Orion',
  'Vardhan', 'Silverline', 'Harborcrest', 'Everpeak', 'Cobalt', 'Greenridge',
  'Suncrest', 'Mosaic', 'Pinnacle', 'Lotusbridge', 'Vertex', 'Amberfield',
  'Clearpath', 'Coralgrid', 'Meridian', 'Oakspire', 'Truenorth', 'Willowbyte',
  'Rainshadow', 'Starling', 'Horizoncraft', 'Maplewave', 'Goldenfern', 'Urbanloom',
  'Lakeshore', 'Ironleaf', 'Cloudmint', 'Redwood', 'Skygarden', 'Stonebridge',
  'Marigold', 'Eastwind', 'Windmere', 'Quartzline', 'Westbrook', 'Aravalli',
  'Monsoon', 'Blueorbit', 'Crescent', 'Dawnfield', 'Saffron', 'Terraforge',
  'Gulmohar', 'Mistral', 'Neelkanth', 'Willowcrest',
];

const companySuffixes = [
  'Transit Systems Private Limited', 'Digital Works Private Limited',
  'Engineering Services Private Limited', 'Supply Network Private Limited',
  'Industrial Solutions Private Limited',
];

const personFirstNames = [
  'Aarav', 'Ishita', 'Kabir', 'Meera', 'Rohan', 'Anaya', 'Vihaan', 'Tara',
  'Arjun', 'Naina', 'Dev', 'Aditi', 'Kunal', 'Mira', 'Advik', 'Riya',
  'Neel', 'Sana', 'Vivaan', 'Ira', 'Yash', 'Diya', 'Manav', 'Kiara',
  'Ritvik', 'Myra', 'Ayaan', 'Navya', 'Reyansh', 'Siya', 'Dhruv', 'Avni',
  'Atharv', 'Isha', 'Shaurya', 'Veda', 'Nikhil', 'Pihu', 'Kartik', 'Aarohi',
];

const personLastNames = [
  'Bhardwaj', 'Kulkarni', 'Menon', 'Chatterjee', 'Rathore', 'Iyer', 'Basu',
  'Deshmukh', 'Nair', 'Saxena',
];

const cities = [
  ['Nashik', 'Maharashtra', '422010'], ['New Delhi', 'Delhi', '110067'],
  ['Bengaluru', 'Karnataka', '560037'], ['Chennai', 'Tamil Nadu', '600096'],
  ['Kolkata', 'West Bengal', '700091'], ['Ahmedabad', 'Gujarat', '380015'],
  ['Jaipur', 'Rajasthan', '302017'], ['Lucknow', 'Uttar Pradesh', '226010'],
  ['Gurugram', 'Haryana', '122018'], ['Hyderabad', 'Telangana', '500081'],
];

const stateCodes = ['MH', 'DL', 'KA', 'TN', 'WB', 'GJ', 'RJ', 'UP', 'HR', 'TS'];
const gstStateCodes = ['27', '28', '29', '33', '19', '24', '08', '09', '06', '36'];

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function companyName(index: number): string {
  return `${companyPrefixes[index]} ${companySuffixes[index % companySuffixes.length]}`;
}

function entityLocation(index: number): { city: string; state: string; pincode: string } {
  const [city, state, pincode] = cities[index % cities.length];
  return { city, state, pincode };
}

function gstin(index: number): string {
  const state = gstStateCodes[index % gstStateCodes.length];
  return `${state}VYTRA${String(index + 1).padStart(4, '0')}K1Z${((index + 4) % 9) + 1}`;
}

function cin(index: number): string {
  const state = stateCodes[index % stateCodes.length];
  const year = 2018 + (index % 7);
  return `U72900${state}${year}PTC${String(100001 + index).padStart(6, '0')}`;
}

function udyam(index: number): string {
  const state = stateCodes[index % stateCodes.length];
  return `UDYAM-${state}-${String((index % 99) + 1).padStart(2, '0')}-${String(index + 1).padStart(7, '0')}`;
}

const panPrefixes = ['QWERT', 'ZXCVB', 'LKJHG', 'MNBVC', 'PLKJH', 'ASDFG', 'HJKLO', 'POIUY', 'NMKJI', 'BVCXZ'];
const panSuffixLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const panHolderFirstNames = ['Aarav', 'Ishita', 'Kabir', 'Meera', 'Rohan', 'Anaya', 'Vihaan', 'Tara', 'Arjun', 'Naina'];
const panHolderLastNames = ['Bhardwaj', 'Kulkarni', 'Menon', 'Chatterjee', 'Rathore', 'Iyer', 'Basu', 'Deshmukh', 'Nair', 'Saxena'];
const panFatherFirstNames = ['Raghav', 'Madhav', 'Samar', 'Vikram', 'Nirav', 'Pranav', 'Keshav', 'Sanjay', 'Harish', 'Manoj'];
const panFatherLastNames = ['Bansal', 'Chauhan', 'Dutta', 'Gokhale', 'Joshi', 'Kapoor', 'Malhotra', 'Naik', 'Pandey', 'Sethi'];

function panNumber(index: number): string {
  return `${panPrefixes[index % panPrefixes.length]}${String(1000 + index).padStart(4, '0')}${panSuffixLetters[index % panSuffixLetters.length]}`;
}

function panName(index: number): string {
  return `${panHolderFirstNames[index % panHolderFirstNames.length]} ${panHolderLastNames[Math.floor(index / panHolderFirstNames.length) % panHolderLastNames.length]}`;
}

function panFatherName(index: number): string {
  return `${panFatherFirstNames[index % panFatherFirstNames.length]} ${panFatherLastNames[Math.floor(index / panFatherFirstNames.length) % panFatherLastNames.length]}`;
}

function maskPan(value: string): string {
  return `${value.slice(0, 2)}****${value.slice(-1)}`;
}

async function seedPanVerifications(): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    const identifier = panNumber(index);
    await prisma.panVerification.upsert({
      where: { panNumber: identifier },
      create: {
        panNumber: identifier,
        panName: panName(index),
        fatherName: panFatherName(index),
        dateOfBirth: date(`${1980 + (index % 20)}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`),
      },
      // Existing verification records are preserved on repeat runs.
      update: {},
    });
  }
}

async function main(): Promise<void> {
  const entities: Array<{ id: number; entityType: 'COMPANY' | 'PERSON'; name: string; address: string; city: string; state: string; pincode: string }> = [];
  const existingEntityCount = await prisma.verificationEntity.count();

  if (existingEntityCount > 0) {
    console.log(`Existing verification data found (${existingEntityCount} entities); preserving all existing tables.`);
  }

  if (existingEntityCount === 0) {
    for (let index = 0; index < 100; index += 1) {
    const isCompany = index < 60;
    const location = entityLocation(index);
    const name = isCompany
      ? companyName(index)
      : `${personFirstNames[index - 60]} ${personLastNames[(index - 60) % personLastNames.length]}`;

    const address = isCompany
      ? `Plot ${101 + index}, Synthetic Industrial Estate, Sector ${((index % 12) + 1).toString().padStart(2, '0')}`
      : `House ${21 + index}, Fictional Residency, Block ${String((index % 8) + 1).padStart(2, '0')}`;

    const entity = await prisma.verificationEntity.create({
      data: {
        entityType: isCompany ? 'COMPANY' : 'PERSON',
        name,
        dateOfBirth: isCompany ? null : date(`${1980 + ((index - 60) % 18)}-${String(((index - 60) % 9) + 1).padStart(2, '0')}-15`),
        dateOfIncorporation: isCompany ? date(`${2017 + (index % 8)}-${String((index % 9) + 1).padStart(2, '0')}-01`) : null,
        address,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        status: index === 7 ? 'SUSPENDED' : index === 31 ? 'INACTIVE' : 'ACTIVE',
      },
    });

    entities.push({ id: entity.id, entityType: isCompany ? 'COMPANY' : 'PERSON', name, address, ...location });
    }

    // One active/current record for every person, then historical inactive records to reach 100 rows.
    for (let index = 0; index < 100; index += 1) {
    const person = entities[60 + (index % 40)];
    await prisma.aadhaarRecord.create({
      data: {
        entityId: person.id,
        aadhaarNumber: `901234${String(index + 1).padStart(6, '0')}`,
        status: index < 40 ? 'ACTIVE' : 'INACTIVE',
      },
    });
    }

    // Company records: the first 60 are current records, and the remaining 40 are historical fixtures.
    for (let index = 0; index < 100; index += 1) {
    const companyIndex = index % 60;
    const company = entities[companyIndex];
    const historical = index >= 60;
    await prisma.gSTRecord.create({
      data: {
        entityId: company.id,
        gstin: gstin(index),
        legalName: company.name,
        tradeName: company.name.replace(' Private Limited', ''),
        registrationDate: date(`${2018 + (index % 7)}-${String((index % 9) + 1).padStart(2, '0')}-10`),
        status: index === 1 ? 'CANCELLED' : index === 2 ? 'SUSPENDED' : historical ? 'CANCELLED' : 'ACTIVE',
      },
    });

    await prisma.cINRecord.create({
      data: {
        entityId: company.id,
        cin: cin(index),
        companyName: company.name,
        incorporationDate: date(`${2017 + (index % 8)}-${String((index % 9) + 1).padStart(2, '0')}-01`),
        companyStatus: index === 5 ? 'STRUCK_OFF' : historical ? 'INACTIVE' : 'ACTIVE',
        registeredAddress: `${company.address}, ${company.city}, ${company.state} ${company.pincode}`,
      },
    });

    await prisma.mSMERecord.create({
      data: {
        entityId: company.id,
        udyamNumber: udyam(index),
        enterpriseName: company.name,
        organisationType: index % 3 === 0 ? 'Private Limited Company' : 'Small Enterprise',
        majorActivity: index % 2 === 0 ? 'Information technology services' : 'Engineering and equipment supply',
        registrationDate: date(`${2020 + (index % 5)}-${String((index % 9) + 1).padStart(2, '0')}-20`),
        status: index === 8 || historical ? 'INACTIVE' : 'ACTIVE',
      },
    });
    }

    for (let index = 0; index < 100; index += 1) {
    const entity = entities[index];
    await prisma.phoneRecord.create({
      data: {
        entityId: entity.id,
        phoneNumber: `91${String(10000001 + index).padStart(8, '0')}`,
        phoneType: index % 12 === 0 ? 'LANDLINE' : 'MOBILE',
        status: index === 22 || index === 77 ? 'INACTIVE' : 'ACTIVE',
      },
    });

    await prisma.emailRecord.create({
      data: {
        entityId: entity.id,
        email: `${entity.entityType === 'COMPANY' ? 'company' : 'person'}${String(index + 1).padStart(3, '0')}@synthetic.example`,
        emailType: entity.entityType === 'COMPANY' ? 'BUSINESS' : 'PERSONAL',
        status: index === 18 || index === 69 ? 'INACTIVE' : 'ACTIVE',
      },
    });
    }
  }

  await seedPanVerifications();
  const panCount = await prisma.panVerification.count();

  console.log(`Seed complete: PAN verification rows available=${panCount}; existing verification data was preserved.`);
  console.log('Perfect-match GST fixture: 27VYTRA0001K1Z5 -> entity 1.');
  console.log('Cancelled GST fixture: 28VYTRA0002K1Z6 -> entity 2.');
  console.log(`Synthetic PAN samples: ${maskPan(panNumber(0))}, ${maskPan(panNumber(1))}, ${maskPan(panNumber(99))}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
