"""Maps Basketball-Reference team abbreviations (historic and current) to our 30 franchises."""

TEAM_TO_FRANCHISE = {
    # Atlanta
    "ATL": "ATL", "STL": "ATL", "MLH": "ATL",
    # Boston
    "BOS": "BOS",
    # Brooklyn
    "BRK": "BKN", "NJN": "BKN", "NYN": "BKN",
    # Charlotte (NBA counts Bobcats/Hornets 2.0 history as one franchise)
    "CHO": "CHA", "CHA": "CHA", "CHH": "CHA",
    # Chicago
    "CHI": "CHI",
    # Cleveland
    "CLE": "CLE",
    # Dallas
    "DAL": "DAL",
    # Denver
    "DEN": "DEN",
    # Detroit
    "DET": "DET", "FTW": "DET",
    # Golden State
    "GSW": "GSW", "SFW": "GSW", "PHW": "GSW",
    # Houston
    "HOU": "HOU", "SDR": "HOU",
    # Indiana
    "IND": "IND",
    # LA Clippers
    "LAC": "LAC", "SDC": "LAC", "BUF": "LAC",
    # LA Lakers
    "LAL": "LAL", "MNL": "LAL",
    # Memphis
    "MEM": "MEM", "VAN": "MEM",
    # Miami
    "MIA": "MIA",
    # Milwaukee
    "MIL": "MIL",
    # Minnesota
    "MIN": "MIN",
    # New Orleans (Hornets 1.0 stays with Charlotte; Pelicans start 2002)
    "NOP": "NOP", "NOH": "NOP", "NOK": "NOP",
    # New York
    "NYK": "NYK",
    # Oklahoma City
    "OKC": "OKC", "SEA": "OKC",
    # Orlando
    "ORL": "ORL",
    # Philadelphia
    "PHI": "PHI", "SYR": "PHI",
    # Phoenix
    "PHO": "PHX",
    # Portland
    "POR": "POR",
    # Sacramento
    "SAC": "SAC", "KCK": "SAC", "KCO": "SAC", "CIN": "SAC", "ROC": "SAC",
    # San Antonio
    "SAS": "SAS",
    # Toronto
    "TOR": "TOR",
    # Utah
    "UTA": "UTA", "NOJ": "UTA",
    # Washington
    "WAS": "WAS", "WSB": "WAS", "BAL": "WAS", "CHZ": "WAS", "CHP": "WAS",
}
