#include "VoyageCalculator.h"
#include <cmath>

using json = nlohmann::json;

namespace VoyageTools
{

double Crew::score(const char *skill, const char *primarySkill, const char *secondarySkill) const noexcept
{
    // TODO: tweak this scoring algorithm (used for presorting the roster per-skill)
    return command_skill + science_skill + security_skill + engineering_skill + diplomacy_skill + medicine_skill +
           get(skill) * 3 + get(primarySkill) * 2.5 + get(secondarySkill) * 1.5;
}

unsigned int Crew::get(const char *skillName) const noexcept
{
    switch (skillName[0])
    {
    case 'c':
        return command_skill;
    case 'e':
        return engineering_skill;
    case 'd':
        return diplomacy_skill;
    case 'm':
        return medicine_skill;
    case 's':
        return skillName[1] == 'c' ? science_skill : security_skill;
    default:
        assert(false);
    }
}

const std::vector<Crew> &SortedCrew::get(const char *skillName) const noexcept
{
    switch (skillName[0])
    {
    case 'c':
        return command_skill;
    case 'e':
        return engineering_skill;
    case 'd':
        return diplomacy_skill;
    case 'm':
        return medicine_skill;
    case 's':
        return skillName[1] == 'c' ? science_skill : security_skill;
    default:
        assert(false);
    }
}

VoyageCalculator::VoyageCalculator(const char* jsonInput) noexcept
{
    j = json::parse(jsonInput);
    primarySkill = j["voyage_skills"]["primary_skill"];
    secondarySkill = j["voyage_skills"]["secondary_skill"];
    shipAntiMatter = j["shipAM"];
    assert(SLOT_COUNT == j["voyage_crew_slots"].size());

    for (const auto &crew : j["crew"])
    {
        if (crew["frozen"] != 0)
            continue;

        Crew c;
        c.id = crew["id"];
        c.command_skill = crew["command_skill"]["core"].get<int16_t>() + (crew["command_skill"]["max"].get<int16_t>() - crew["command_skill"]["min"].get<int16_t>()) / 2;
        c.science_skill = crew["science_skill"]["core"].get<int16_t>() + (crew["science_skill"]["max"].get<int16_t>() - crew["science_skill"]["min"].get<int16_t>()) / 2;
        c.security_skill = crew["security_skill"]["core"].get<int16_t>() + (crew["security_skill"]["max"].get<int16_t>() - crew["security_skill"]["min"].get<int16_t>()) / 2;
        c.engineering_skill = crew["engineering_skill"]["core"].get<int16_t>() + (crew["engineering_skill"]["max"].get<int16_t>() - crew["engineering_skill"]["min"].get<int16_t>()) / 2;
        c.diplomacy_skill = crew["diplomacy_skill"]["core"].get<int16_t>() + (crew["diplomacy_skill"]["max"].get<int16_t>() - crew["diplomacy_skill"]["min"].get<int16_t>()) / 2;
        c.medicine_skill = crew["medicine_skill"]["core"].get<int16_t>() + (crew["medicine_skill"]["max"].get<int16_t>() - crew["medicine_skill"]["min"].get<int16_t>()) / 2;
        roster.emplace_back(std::move(c));
    }

    sortedRoster.setSearchDepth(j["search_depth"]);

    std::partial_sort_copy(roster.begin(), roster.end(), sortedRoster.command_skill.begin(), sortedRoster.command_skill.end(),
                           [&](Crew i, Crew j) { return (i.score("command_skill", primarySkill.c_str(), secondarySkill.c_str()) > j.score("command_skill", primarySkill.c_str(), secondarySkill.c_str())); });

    std::partial_sort_copy(roster.begin(), roster.end(), sortedRoster.science_skill.begin(), sortedRoster.science_skill.end(),
                           [&](Crew i, Crew j) { return (i.score("science_skill", primarySkill.c_str(), secondarySkill.c_str()) > j.score("science_skill", primarySkill.c_str(), secondarySkill.c_str())); });

    std::partial_sort_copy(roster.begin(), roster.end(), sortedRoster.security_skill.begin(), sortedRoster.security_skill.end(),
                           [&](Crew i, Crew j) { return (i.score("security_skill", primarySkill.c_str(), secondarySkill.c_str()) > j.score("security_skill", primarySkill.c_str(), secondarySkill.c_str())); });

    std::partial_sort_copy(roster.begin(), roster.end(), sortedRoster.engineering_skill.begin(), sortedRoster.engineering_skill.end(),
                           [&](Crew i, Crew j) { return (i.score("engineering_skill", primarySkill.c_str(), secondarySkill.c_str()) > j.score("engineering_skill", primarySkill.c_str(), secondarySkill.c_str())); });

    std::partial_sort_copy(roster.begin(), roster.end(), sortedRoster.diplomacy_skill.begin(), sortedRoster.diplomacy_skill.end(),
                           [&](Crew i, Crew j) { return (i.score("diplomacy_skill", primarySkill.c_str(), secondarySkill.c_str()) > j.score("diplomacy_skill", primarySkill.c_str(), secondarySkill.c_str())); });

    std::partial_sort_copy(roster.begin(), roster.end(), sortedRoster.medicine_skill.begin(), sortedRoster.medicine_skill.end(),
                           [&](Crew i, Crew j) { return (i.score("medicine_skill", primarySkill.c_str(), secondarySkill.c_str()) > j.score("medicine_skill", primarySkill.c_str(), secondarySkill.c_str())); });

    for (size_t i = 0; i < SLOT_COUNT; i++)
    {
        slotRoster[i] = &sortedRoster.get(j["voyage_crew_slots"][i]["skill"].get<std::string>().c_str());
        slotNames[i] = j["voyage_crew_slots"][i]["name"].get<std::string>();
    }
}

void VoyageCalculator::fillSlot(size_t slot) noexcept
{
    for (const auto &crew : *slotRoster[slot])
    {
        if (slot == 0)
        {
            //std::cout << "Processing " << crew.id << "\n";
        }

        bool alreadyIn = false;
        for (size_t i = 0; i < slot; i++)
        {
            if (considered[i]->id == crew.id)
            {
                alreadyIn = true;
                break;
            }
        }

        if (alreadyIn)
            continue;

        considered[slot] = &crew;

        if (slot < SLOT_COUNT - 1)
        {
            fillSlot(slot + 1);
        }
        else
        {
            // we have a complete crew complement, compute score
            //TODO: traits for slot
            double score = calculateDuration(considered);

            if (score > bestscore)
            {
                bestconsidered = considered;
                bestscore = score;
                progressUpdate(bestconsidered, bestscore);
            }
        }

        considered[slot] = nullptr;
    }
}

double VoyageCalculator::calculateDuration(std::array<const Crew *, SLOT_COUNT> complement) noexcept
{
    unsigned int shipAM = shipAntiMatter;
    Crew totals;
    for (const auto &crew : complement)
    {
        totals.command_skill += crew->command_skill;
        totals.science_skill += crew->science_skill;
        totals.security_skill += crew->security_skill;
        totals.engineering_skill += crew->engineering_skill;
        totals.diplomacy_skill += crew->diplomacy_skill;
        totals.medicine_skill += crew->medicine_skill;

        if (crew->hasTrait)
        {
            shipAM += 25;
        }
    }

    unsigned int PrimarySkill = totals.get(primarySkill.c_str());
    unsigned int SecondarySkill = totals.get(secondarySkill.c_str());
    unsigned int OtherSkills = 0;
    unsigned int MaxSkill = 0;

    auto lambdaSkills = [&](unsigned int skill) {
        if ((skill != PrimarySkill) && (skill != SecondarySkill))
            OtherSkills += skill;

        if (skill > MaxSkill)
            MaxSkill = skill;
    };

    lambdaSkills(totals.command_skill);
    lambdaSkills(totals.science_skill);
    lambdaSkills(totals.security_skill);
    lambdaSkills(totals.engineering_skill);
    lambdaSkills(totals.diplomacy_skill);
    lambdaSkills(totals.medicine_skill);

    // Code translated from Chewable C++'s JS implementation from https://codepen.io/somnivore/pen/Nabyzw
    // TODO: make this prettier

	//let maxExtends = 100000
	unsigned int maxExtends = 0; // we only care about the first one atm
		
	// variables
	unsigned int ticksPerCycle = 28;
	unsigned int secondsPerTick = 20;
	unsigned int cycleSeconds = ticksPerCycle*secondsPerTick;
	double cyclesPerHour = 60*60/cycleSeconds;
	unsigned int hazPerCycle = 6;
	double activityPerCycle = 18;
	double dilemmasPerHour = 0.5;
	double hazPerHour = hazPerCycle*cyclesPerHour-dilemmasPerHour;
	unsigned int hazSkillPerHour = 1250;
	double hazSkillVariance = 0.15; // todo: from input
	unsigned int hazAmPass = 5;
	unsigned int hazAmFail = 30;
	double activityAmPerHour = activityPerCycle*cyclesPerHour;
	unsigned int minPerHour = 60;
	double psChance = 0.35;
	double ssChance = 0.25;
	double osChance = 0.1;
	unsigned int dilPerMin = 5;

	unsigned int elapsedHours = 0; // TODO: deal with this later
	unsigned int elapsedHazSkill = elapsedHours*hazSkillPerHour;
	
	MaxSkill = std::max((unsigned int)0, MaxSkill - elapsedHazSkill);
	double endVoySkill = MaxSkill*(1+hazSkillVariance);

    std::vector<unsigned int> skills = {totals.command_skill, totals.science_skill, totals.security_skill, totals.engineering_skill, totals.diplomacy_skill, totals.medicine_skill};
    std::vector<double> skillChances = {osChance,osChance,osChance,osChance,osChance,osChance};

    for (size_t i = 0; i <= skills.size(); i++)
    {
        if (skills[i] == PrimarySkill)
            skillChances[i] = psChance;

        if (skills[i] == SecondarySkill)
            skillChances[i] = ssChance;
    }

	double totalRefillCost = 0;
	double voyTime = 0;
	for (size_t extend = 0; extend <= maxExtends; extend++)
    {
		// converging loop - refine calculation based on voyage time every iteration
		unsigned int tries = 0;
		while (true)
        {
			tries++;
			if (tries == 100)
            {
				//console.error("Something went wrong! Check your inputs.")
				break;
			}

			//test.text += Math.floor(endVoySkill) + " "
			double am = shipAM + shipAM*extend;
			for (size_t i = 0; i < 6; i++)
            {
				unsigned int skill = skills[i];
				skill = std::max((unsigned int)0, skill-elapsedHazSkill);
				double chance = skillChances[i];

				// skill amount for 100% pass
				double passSkill = std::min(endVoySkill,skill*(1-hazSkillVariance));

				// skill amount for RNG pass
				// (compute passing proportion of triangular RNG area - integral of x)
				double skillRngRange = skill*hazSkillVariance*2;
				double lostRngProportion = 0;
				if (skillRngRange > 0)
                { // avoid division by 0
					lostRngProportion = std::max(0.0, std::min(1.0, (skill*(1+hazSkillVariance) - endVoySkill) / skillRngRange));
				}
				double skillPassRngProportion = 1 - lostRngProportion*lostRngProportion;
				passSkill += skillRngRange*skillPassRngProportion/2;

				// am gained for passing hazards
				am += passSkill * chance / hazSkillPerHour * hazPerHour * hazAmPass;

				// skill amount for 100% hazard fail
				double failSkill = std::max(0.0, endVoySkill-skill*(1+hazSkillVariance));
				// skill amount for RNG fail
				double skillFailRngProportion = std::pow(1-lostRngProportion, 2);
				failSkill += skillRngRange*skillFailRngProportion/2;

				// am lost for failing hazards
				am -= failSkill * chance / hazSkillPerHour * hazPerHour * hazAmFail;
			}

			double amLeft = am - endVoySkill/hazSkillPerHour*activityAmPerHour;
			double timeLeft = amLeft / (hazPerHour*hazAmFail + activityAmPerHour);

			voyTime = endVoySkill/hazSkillPerHour + timeLeft + elapsedHours;

			if (timeLeft > 0.001)
            {
				endVoySkill = (voyTime-elapsedHours)*hazSkillPerHour;
				continue;
			}
            else
            {
				break;
			}
		}

		// compute other results
		double safeTime = voyTime*0.95;
		double saferTime = voyTime*0.90;
		double refillTime = shipAM / (hazPerHour*hazAmFail + activityAmPerHour);
		double refillCost = std::ceil(voyTime*60/dilPerMin);

		// display results
		/*if (extend < 3)
        {
			//window['result'+extend].value = timeToString(voyTime)
			//window['safeResult'+extend].value = timeToString(safeTime)
			//window['saferResult'+extend].value = timeToString(saferTime)
			if (extend > 0)
				window['refillCostResult'+extend].value = totalRefillCost
			//test.text = MaxSkill*(1+hazSkillVariance)/hazSkillPerHour
			// the threshold here is just a guess
			if (MaxSkill/hazSkillPerHour > voyTime) {
				let tp = Math.floor(voyTime*hazSkillPerHour)
				// TODO: warn somehow
				//setWarning(extend, "Your highest skill is too high by about " + Math.floor(MaxSkill - voyTime*hazSkillPerHour) + ". To maximize voyage time, redistribute more like this: " + tp + "/" + tp + "/" + tp/4 + "/" + tp/4 + "/" + tp/4 + "/" + tp/4 + ".")
			}
		}
		
		totalRefillCost += refillCost
		
		if (voyTime >= 20) {
			//test.text += "hi"
			// TODO: show 20 hr?
			//window['20hrdil'].value = totalRefillCost
			//window['20hrrefills'].value = extend
			break
		}*/

		return voyTime;
    }

    return 0;
}

} //namespace VoyageTools