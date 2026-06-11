/**
 * Toji Project - Address Database
 * Developed by @RealYashvirGaming
 */

export const ADDRESS_DB = {
    US: {
        streets: ['Main Street', 'Oak Avenue', 'Maple Drive', 'Washington Street', 'Broadway', 'Park Avenue'],
        cities: ['Hendersonville', 'Nashville', 'Raleigh', 'Charlotte', 'New York', 'Los Angeles', 'Chicago'],
        zipFormat: () => String(Math.floor(10000 + Math.random() * 90000)),
        names: {
            first: ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth'],
            last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
        }
    },
    GB: {
        streets: ['High Street', 'Church Road', 'London Road', 'Green Lane', 'Park Road'],
        cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'],
        zipFormat: () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
            return r(chars) + r(chars) + Math.floor(1 + Math.random() * 9) + ' ' + Math.floor(1 + Math.random() * 9) + r(chars) + r(chars);
        },
        names: {
            first: ['Oliver', 'George', 'Noah', 'Isla', 'Arthur', 'Olivia', 'Amelia'],
            last: ['Taylor', 'Smith', 'Williams', 'Brown', 'Davies', 'Evans']
        }
    },
    CA: {
        streets: ['Bay Street', 'Granville Street', 'Yonge Street', 'Sainte-Catherine'],
        cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Edmonton'],
        zipFormat: () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
            return r(chars) + Math.floor(Math.random() * 10) + r(chars) + ' ' + Math.floor(Math.random() * 10) + r(chars) + Math.floor(Math.random() * 10);
        },
        names: {
            first: ['Liam', 'Emma', 'Noah', 'Olivia', 'Ethan', 'Sophia'],
            last: ['Smith', 'Johnson', 'Brown', 'Wilson', 'Taylor']
        }
    },
    DE: {
        streets: ['Hauptstraße', 'Schulstraße', 'Gartenstraße', 'Bahnhofstraße', 'Amselweg'],
        cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
        zipFormat: () => String(Math.floor(10000 + Math.random() * 89999)),
        names: {
            first: ['Lukas', 'Lara', 'Finn', 'Mia', 'Leon', 'Emma'],
            last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Meyer']
        }
    },
    FR: {
        streets: ['Rue de la Paix', 'Rue de Rivoli', 'Rue de la Pompe', 'Rue Victor Hugo'],
        cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice'],
        zipFormat: () => String(Math.floor(10000 + Math.random() * 89999)),
        names: {
            first: ['Jean', 'Marie', 'Pierre', 'Camille', 'Gabriel', 'Louise'],
            last: ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert']
        }
    },
    JP: {
        streets: ['Nakamachi', 'Honmachi', 'Sakaemachi', 'Kotobukicho'],
        cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya'],
        zipFormat: () => String(Math.floor(100 + Math.random() * 899)) + '-' + String(Math.floor(1000 + Math.random() * 8999)),
        names: {
            first: ['Ren', 'Haruto', 'Minato', 'Yua', 'Himari', 'Ichika'],
            last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Ito']
        }
    }
};

export class AddressGenerator {
    static async generate(countryCode = 'US') {
        try {
            const resp = await fetch(`https://randomuser.me/api/1.2/?nat=${countryCode.toUpperCase()}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.results && data.results.length > 0) {
                    const user = data.results[0];
                    const firstName = user.name.first.charAt(0).toUpperCase() + user.name.first.slice(1);
                    const lastName = user.name.last.charAt(0).toUpperCase() + user.name.last.slice(1);
                    
                    return {
                        name: `${firstName} ${lastName}`,
                        email: `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@gmail.com`,
                        street: user.location.street,
                        city: user.location.city,
                        state: user.location.state,
                        zip: String(user.location.postcode),
                        country: countryCode.toUpperCase()
                    };
                }
            }
        } catch (err) {
            console.warn('[Toji Project] RandomUser API fetch failed, falling back to local DB', err);
        }

        const db = ADDRESS_DB[countryCode.toUpperCase()] || ADDRESS_DB.US;
        const firstName = db.names.first[Math.floor(Math.random() * db.names.first.length)];
        const lastName = db.names.last[Math.floor(Math.random() * db.names.last.length)];
        const street = (Math.floor(100 + Math.random() * 900)) + ' ' + db.streets[Math.floor(Math.random() * db.streets.length)];
        const city = db.cities[Math.floor(Math.random() * db.cities.length)];
        const zip = db.zipFormat();

        return {
            name: `${firstName} ${lastName}`,
            email: `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@gmail.com`,
            street,
            city,
            zip,
            country: countryCode.toUpperCase()
        };
    }
}
