"""
Run from Flask project root:
    python migrate_party_links_manual.py

Ye script specific known mappings apply karta hai jo fuzzy match miss kar gaya.
Sirf woh mappings add karo jinhe tum confident ho.
"""

from app import create_app, db
from app.models.sample import Sample
from app.models.party import Party

app = create_app()

# =====================================================
# KNOWN MAPPINGS — party_name_direct → party_code
# Sirf confident mappings yahan daalo
# =====================================================
MANUAL_MAPPINGS = {
    # HEADWAY variants → A-2198
    'HEADWAY':                          'A-2198',
    'HEADWAY CRAFT':                    'A-2198',
    'HEADWAY CRAFTS':                   'A-2198',
    'HEADWAY CRFT PVT.':                'A-2198',
    'HEADAY CRAFTS':                    'A-2198',

    # NEOKRAFT variants → A-630
    'NEOCRAFT':                         'A-630',
    'NEOCRAFTT':                        'A-630',
    'NEOKRAFT':                         'A-630',
    'NEOKRAFTS':                        'A-630',
    'NEO KRAFT':                        'A-630',
    'NEW KRAFT':                        'A-630',

    # WAZIR CHAND variants → A-1589
    'WAZIR CHAND':                      'A-1589',
    'WAZIRCHAND':                       'A-1589',
    'WAZICHAND':                        'A-1589',

    # PR CELLING variants → A-2384
    'PR CEILING':                       'A-2384',
    'PR CEILLING':                      'A-2384',
    'PR CELLING':                       'A-2384',
    'P.R CELLING':                      'A-2384',

    # LOHIYA variants
    'LOHIYA':                           'A-2452',
    'LOHIA CORP':                       'A-202',

    # PARTH variants
    'PARTH':                            'A-746',
    'PATH':                             'A-746',

    # RAJ SHREE
    'RAJ SHREE':                        'A-870',

    # MAK variants — check karo pehle
    # 'MAK':                            'A-???',
    # 'MAK ENG.':                       'A-???',

    # CLG variants — tum decide karo kaunsa kahan jaata hai
    # 'CLG':                            'A-1901',   # CLG EXPORT?
    # 'CLG IKEA':                       'A-2445',   # CLG OVERSEAS?
    # 'CLG SEZ':                        'A-2446',   # CLG EXPORT METAL DIV?
    # 'CLG NON IKEA':                   'A-1901',
    # 'CLG KICHLER':                    'A-1901',

    # K&K variants
    'K&K':                              'A-2377',
    'K&K EXPORT BAREILLY':              'A-2377',

    # UNIQUE TECNO
    'UNIQUE TECNO':                     'A-1471',

    # SANGHVI (without export)
    'SANGHVI':                          'A-1064',
    'SHANGHAVI':                        'A-1064',

    # SIGMA
    # 'SIGMA':                          'A-???',  # check karo

    # DHRUV variants — check karo
    # 'DHRUV':                          'A-???',
    # 'DHRUV INT.':                     'A-???',

    # UP TELELINK variants
    'UP TELELINK LIMITED':              'A-1481',
    'UP TELELINK SINGHAM':              'A-1481',
    'M.S U.P.TELELINKS LIMITED':        'A-1481',
    'SINGHAM UP TELELINKA LIMITED':     'A-1481',

    # MARTCO
    'MARTCO':                           'A-478',

    # PARAMOUNT
    'PARAMOUNT':                        'A-738',

    # EXPRESSION variants
    'EXPRESSION':                       'A-276',

    # COMET
    'COMET':                            'A-1904',

    # SKI / S.K.I
    'SKI':                              'A-982',   # S K TRADERS? ya alag hai?
    'S.K.I':                            'A-982',

    # S.K WELDED MESH variants
    'S.K WELDED MESH':                  'A-1539',  # check karo party code
    'S.K. WELDED MESH':                 'A-1539',
    'SK WELDED MESH PVT.LTD.':          'A-1539',
}

with app.app_context():

    # Build party_code → Party lookup
    all_parties = Party.query.all()
    party_by_code = {p.party_code.strip().upper(): p for p in all_parties if p.party_code}

    linked = 0
    not_found_code = []
    not_found_sample = []

    for raw_name, target_code in MANUAL_MAPPINGS.items():
        raw_upper = raw_name.strip().upper()
        target_upper = target_code.strip().upper()

        party = party_by_code.get(target_upper)
        if not party:
            not_found_code.append(f"{raw_name} → {target_code} (party code not in DB)")
            continue

        samples = Sample.query.filter(
            Sample.party_id == None,
            db.func.upper(Sample.party_name_direct) == raw_upper
        ).all()

        if not samples:
            continue  # already linked or doesn't exist

        for s in samples:
            s.party_id = party.id
            s.party_name_direct = None
            linked += 1

        print(f"✓ '{raw_name}' → '{party.party_name}' ({target_code}): {len(samples)} sample(s)")

    db.session.commit()

    print(f"\n{'='*50}")
    print(f"✓ Total linked: {linked}")

    if not_found_code:
        print(f"\nParty codes not found in DB (fix the mapping):")
        for e in not_found_code:
            print(f"  - {e}")

    # Show remaining unlinked count
    remaining = Sample.query.filter(
        Sample.party_id == None,
        Sample.party_name_direct != None,
        Sample.party_name_direct != ''
    ).count()
    print(f"\nStill unlinked: {remaining} samples")