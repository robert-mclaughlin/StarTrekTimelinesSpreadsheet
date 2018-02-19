#include "VoyageCalculator.h"
#include <cmath>
#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <map>

using json = nlohmann::json;

namespace VoyageTools
{

unsigned int Crew::computeScore(size_t skill, size_t trait, size_t primarySkill, size_t secondarySkill) const noexcept
{
	if (skills[skill] == 0)
		return 0;
	unsigned int score = 0;
	for (size_t iSkill = 0; iSkill < SKILL_COUNT; ++iSkill) {
		unsigned int skillScore = skills[iSkill];
		if (iSkill == primarySkill)
			skillScore = skillScore*7/2;
		else if (iSkill == secondarySkill)
			skillScore = skillScore*5/2;
		score += skillScore;
	};
	
	if (traits[trait]) {
		score += 200; // inexact but based on currently known constants
	}
	
	return score;
}

VoyageCalculator::VoyageCalculator(const char* jsonInput) noexcept
{
	//assert(false);
    j = json::parse(jsonInput);

	std::map<std::string, size_t> skillMap;
	skillMap.insert({"command_skill",0});
	skillMap.insert({"science_skill",1});
	skillMap.insert({"security_skill",2});
	skillMap.insert({"engineering_skill",3});
	skillMap.insert({"diplomacy_skill",4});
	skillMap.insert({"medicine_skill",5});

    primarySkillName = j["voyage_skills"]["primary_skill"];
    secondarySkillName = j["voyage_skills"]["secondary_skill"];

	primarySkill = skillMap[primarySkillName];
	secondarySkill = skillMap[secondarySkillName];

    shipAntiMatter = j["shipAM"];
    assert(SLOT_COUNT == j["voyage_crew_slots"].size());

	size_t traitId = 0;
	std::unordered_map<std::string, size_t> traitMap;

	auto fGetTrait = [&](const std::string &trait) {
		auto iTrait = traitMap.find(trait);
		if (iTrait == traitMap.end()) {
			iTrait = traitMap.insert({trait, traitId++}).first;
		}
		return iTrait->second;
	};

    for (const auto &crew : j["crew"])
    {
        if (crew["frozen"] != 0)
            continue;

        Crew c;
        c.id = crew["id"];
		c.name = crew["name"];
		for (const auto &skill : skillMap) {
			c.skillMaxProfs[skill.second] = crew[skill.first]["max"].get<int16_t>();
			c.skillMinProfs[skill.second] = crew[skill.first]["min"].get<int16_t>();
			c.skills[skill.second] = crew[skill.first]["core"].get<int16_t>()
				+ (c.skillMaxProfs[skill.second] + c.skillMinProfs[skill.second]) / 2;
		}

		for (const std::string &trait : crew["traits"]) {
			size_t iTrait = fGetTrait(trait);
			if (iTrait >= c.traits.size()) {
				c.traits.resize(iTrait+1, false);
			}
			c.traits[iTrait] = true;
		}

		/*std::cout << c.name << " " << c.skills[0] << " " << c.skills[1] << " " << c.skills[2] << " "
			<< c.skills[3] << " " << c.skills[4] << " " << c.skills[5] << " " << c.traits[0] << std::endl;*/

        roster.emplace_back(std::move(c));
    }

    for (size_t iSlot = 0; iSlot < SLOT_COUNT; iSlot++)
    {
		slotNames[iSlot] = j["voyage_crew_slots"][iSlot]["name"].get<std::string>();
		slotSkillNames[iSlot] = j["voyage_crew_slots"][iSlot]["skill"].get<std::string>().c_str();
		slotSkills[iSlot] = skillMap[slotSkillNames[iSlot]];
		slotTraits[iSlot] = fGetTrait(j["voyage_crew_slots"][iSlot]["trait"].get<std::string>());
    }

	//std::cout << "encountered " << traitId << " traits" << std::endl;
	for (Crew &crew : roster) {
		crew.traits.resize(traitId+1,false);
	}

	sortedRoster.setSearchDepth(j["search_depth"]);

	for (size_t iSlot = 0; iSlot < SLOT_COUNT; iSlot++)
    {
		auto &slotRoster = sortedRoster.slotRosters[iSlot];
		slotRoster.resize(roster.size());
		for (size_t iCrew = 0; iCrew < roster.size(); ++iCrew) {
			slotRoster[iCrew] = roster[iCrew];
			slotRoster[iCrew].original = &roster[iCrew];
			
			slotRoster[iCrew].score = slotRoster[iCrew].computeScore(
				slotSkills[iSlot], slotTraits[iSlot], primarySkill, secondarySkill);
		}
		std::sort(slotRoster.begin(), slotRoster.end(),
			[&](const Crew &left, const Crew &right) {
				return (left.score > right.score);
		});

        this->slotRoster[iSlot] = &sortedRoster.slotRosters[iSlot];
	}
}

void VoyageCalculator::calculate()
{
	// find the nth highest crew score
	std::vector<unsigned int> slotCrewScores;
	for (size_t iSlot = 0; iSlot < SLOT_COUNT; ++iSlot) {
		const std::vector<Crew> *slot = slotRoster[iSlot];
		for (const Crew &crew : *slot) {
			slotCrewScores.emplace_back(crew.score);
		}
	}

	std::sort(slotCrewScores.begin(), slotCrewScores.end(), std::greater<unsigned int>());

	unsigned int minScore = 
		slotCrewScores[std::min(slotCrewScores.size()-1, sortedRoster.depth * SLOT_COUNT)];
	size_t minDepth = 2; // ?

	auto debugOuput = [&]
	{
		for (size_t iSlot = 0; iSlot < SLOT_COUNT; ++iSlot) {
			std::cout << slotSkillNames[iSlot] << std::endl;
			for (size_t iCrew = 0; iCrew < slotRoster[iSlot]->size(); ++iCrew)
			{
				const auto &crew = slotRoster[iSlot]->at(iCrew);
				if (iCrew >= minDepth && crew.score < minScore)
				{
					break;
				}
				std::cout << "  " << crew.score << " - " << crew.name << std::endl;
			}
			std::cout << std::endl;
		}
	};

	debugOuput();

	std::cout << "minScore " << minScore << std::endl;
	std::cout << "primary " << primarySkillName << "(" << primarySkill << ")" << std::endl;
	std::cout << "secondary " << secondarySkillName << "(" << secondarySkill << ")" << std::endl;
	
	Timer::Scope calcTimeScope(voyageCalcTime);

	for (size_t iMinDepth = minDepth; iMinDepth < 10; ++iMinDepth) {
		fillSlot(0, minScore, iMinDepth);
		if (bestscore > 0)
			break;
	}
}

void VoyageCalculator::fillSlot(size_t slot, unsigned int minScore, size_t minDepth)
{
	for (size_t iCrew = 0; iCrew < slotRoster[slot]->size(); ++iCrew)
    {
		const auto &crew = slotRoster[slot]->at(iCrew);
		if (iCrew >= minDepth && minScore > crew.score)
		{
			break;
		}

        if (crew.original->considered)
            continue;

        considered[slot] = &crew;
		crew.original->considered = true;

        if (slot < SLOT_COUNT - 1)
        {
            fillSlot(slot + 1, minScore, minDepth);
        }
        else
        {
            // we have a complete crew complement, compute score
            float score = calculateDuration(considered);

            if (score > bestscore)
            {
				std::cout << "new best found: " << score << std::endl;
                bestconsidered = considered;
                bestscore = score;
                progressUpdate(bestconsidered, bestscore);
				calculateDuration(considered, true); // debug
            }
        }

        crew.original->considered = false;
    }
}

float VoyageCalculator::calculateDuration(std::array<const Crew *, SLOT_COUNT> complement, bool debug) noexcept
{
    unsigned int shipAM = shipAntiMatter;
    Crew totals;
	totals.skills.fill(0);

	std::array<unsigned int, SKILL_COUNT> totalProfRange;
	totalProfRange.assign(0);
	unsigned int totalSkill = 0;

	for (size_t iSlot = 0; iSlot < SLOT_COUNT; ++iSlot)
	{
		const auto &crew = complement[iSlot];

		// NOTE: this is not how the game client displays totals
		//	the game client seems to add all profs first, then divide by 2,
		//	which is slightly more precise.
		for (size_t iSkill = 0; iSkill < SKILL_COUNT; ++iSkill) {
			totals.skills[iSkill] += crew->skills[iSkill];
			totalProfRange[iSkill] += crew->skillMaxProfs[iSkill] - crew->skillMinProfs[iSkill];
		}

        if (crew->traits[slotTraits[iSlot]])
        {
            shipAM += 25;
        }
    }

	for (size_t iSkill = 0; iSkill < SKILL_COUNT; ++iSkill) {
		totalSkill += totals.skills[iSkill];
	}

	if (debug) {
		std::cout << shipAM << " "
			<< totals.skills[0] << " " << totals.skills[1] << " " << totals.skills[2] << " "
			<< totals.skills[3] << " " << totals.skills[4] << " " << totals.skills[5] << std::endl;
	}

    unsigned int PrimarySkill = totals.skills[primarySkill];
    unsigned int SecondarySkill = totals.skills[secondarySkill];
    unsigned int MaxSkill = 0;

	std::array<float, SKILL_COUNT> hazSkillVariance;
	for (size_t iSkill = 0; iSkill < SKILL_COUNT; ++iSkill) {
		hazSkillVariance[iSkill] = ((float)totalProfRange[iSkill])/2/totals.skills[iSkill];
		if (totals.skills[iSkill] > MaxSkill)
			MaxSkill = totals.skills[iSkill];
	}

    // Code translated from Chewable C++'s JS implementation from https://codepen.io/somnivore/pen/Nabyzw
    // TODO: make this prettier

	//let maxExtends = 100000
	unsigned int maxExtends = 0; // we only care about the first one atm
		
	// variables
	constexpr unsigned int ticksPerCycle = 28;
	constexpr unsigned int secondsPerTick = 20;
	constexpr unsigned int cycleSeconds = ticksPerCycle*secondsPerTick;
	constexpr float cyclesPerHour = 60*60/(float)cycleSeconds;
	constexpr unsigned int hazPerCycle = 6;
	constexpr float activityPerCycle = 18;
	constexpr float dilemmasPerHour = 0.5f;
	constexpr float hazPerHour = hazPerCycle*cyclesPerHour-dilemmasPerHour;
	constexpr unsigned int hazSkillPerHour = 1250;
	constexpr unsigned int hazAmPass = 5;
	constexpr unsigned int hazAmFail = 30;
	constexpr float activityAmPerHour = activityPerCycle*cyclesPerHour;
	constexpr unsigned int minPerHour = 60;
	constexpr float psChance = 0.35f;
	constexpr float ssChance = 0.25f;
	constexpr float osChance = 0.1f;
	constexpr unsigned int dilPerMin = 5;

	if (debug) {
		std::cout << "primary skill prof variance: " << hazSkillVariance[primarySkill] << std::endl;
	}

	unsigned int elapsedHours = 0; // TODO: deal with this later
	unsigned int elapsedHazSkill = elapsedHours*hazSkillPerHour;
	
	MaxSkill = std::max((unsigned int)0, MaxSkill - elapsedHazSkill);
	float endVoySkill = MaxSkill*(1+hazSkillVariance[primarySkill]);

    const std::array<unsigned int,SKILL_COUNT> &skills = totals.skills;
    std::array<float,6> skillChances;
	skillChances.fill(osChance);

    for (size_t iSkill = 0; iSkill < skills.size(); iSkill++)
    {
        if (iSkill == primarySkill) {
            skillChances[iSkill] = psChance;
			if (debug) {
				std::cout << "pri: " << skills[iSkill] << std::endl;
			}
		}
		else if (iSkill == secondarySkill) {
            skillChances[iSkill] = ssChance;
			if (debug) {
				std::cout << "sec: " << skills[iSkill] << std::endl;
			}
		}
    }

	float totalRefillCost = 0;
	float voyTime = 0;
	for (size_t extend = 0; extend <= maxExtends; extend++)
    {
		// converging loop - refine calculation based on voyage time every iteration
		unsigned int tries = 0;
		for (;;)
        {
			tries++;
			if (tries == 100)
            {
				std::cout << "something went wrong!" << std::endl;
				//console.error("Something went wrong! Check your inputs.")
				break;
			}

			//test.text += Math.floor(endVoySkill) + " "
			float am = (float)(shipAM + shipAM*extend);
			for (size_t iSkill = 0; iSkill < SKILL_COUNT; iSkill++)
            {
				unsigned int skill = skills[iSkill];
				skill = std::max((unsigned int)0, skill-elapsedHazSkill);
				float chance = skillChances[iSkill];

				// skill amount for 100% pass
				float passSkill = std::min(endVoySkill,skill*(1-hazSkillVariance[iSkill]));

				// skill amount for RNG pass
				// (compute passing proportion of triangular RNG area - integral of x)
				float skillRngRange = skill*hazSkillVariance[iSkill]*2;
				float lostRngProportion = 0;
				if (skillRngRange > 0)
                { // avoid division by 0
					lostRngProportion = std::max(0.0f, std::min(1.0f, (skill*(1+hazSkillVariance[iSkill]) - endVoySkill) / skillRngRange));
				}
				float skillPassRngProportion = 1 - lostRngProportion*lostRngProportion;
				passSkill += skillRngRange*skillPassRngProportion/2;

				// am gained for passing hazards
				am += passSkill * chance / hazSkillPerHour * hazPerHour * hazAmPass;

				// skill amount for 100% hazard fail
				float failSkill = std::max(0.0f, endVoySkill-skill*(1+hazSkillVariance[iSkill]));
				// skill amount for RNG fail
				float skillFailRngProportion = (1-lostRngProportion)*(1-lostRngProportion);
				failSkill += skillRngRange*skillFailRngProportion/2;

				// am lost for failing hazards
				am -= failSkill * chance / hazSkillPerHour * hazPerHour * hazAmFail;
			}

			float amLeft = am - endVoySkill/hazSkillPerHour*activityAmPerHour;
			float timeLeft = amLeft / (hazPerHour*hazAmFail + activityAmPerHour);

			voyTime = endVoySkill/hazSkillPerHour + timeLeft + elapsedHours;

			if (std::abs(timeLeft) > 0.001f)
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
	/*	float safeTime = voyTime*0.95f;
		float saferTime = voyTime*0.90f;
		float refillTime = shipAM / (hazPerHour*hazAmFail + activityAmPerHour);
		float refillCost = std::ceil(voyTime*60/dilPerMin);*/

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