#include "VoyageCrewRanker.h"
#include <unordered_map>

namespace VoyageTools
{

std::vector<RankedCrew> RankVoyageCrew(const char *jsonInput) noexcept
{
	std::unordered_map<int, RankedCrew> rankedCrew;

	// compute for all voyage skill combos
	for (size_t primarySkill = 0; primarySkill < SKILL_COUNT; ++primarySkill)
	for (size_t secondarySkill = 0; secondarySkill < SKILL_COUNT; ++secondarySkill)
	{
		if (primarySkill == secondarySkill)
			continue;

		VoyageCalculator calculator(jsonInput, true);
		calculator.SetInput(primarySkill, secondarySkill);
		calculator.DisableTraits();

		double dontcare;
		std::array<const Crew*, SLOT_COUNT> voyCrew = 
			calculator.Calculate([](auto...){}, dontcare);

		for (const Crew * crew : voyCrew) {
			RankedCrew &rCrew = rankedCrew[crew->id];
			rCrew.crew = *crew;
			++rCrew.score;
			rCrew.voySkills.push_back(std::make_pair(primarySkill, secondarySkill));
		}

		for (unsigned int altLevel = 0; altLevel < RankedCrew::altLevels; ++altLevel) {
			CrewArray altCrew = calculator.GetAlternateCrew(altLevel);
			for (const Crew * crew : altCrew) {
				if (crew == nullptr)
					continue;
				RankedCrew &rCrew = rankedCrew[crew->id];
				rCrew.crew = *crew;
				rCrew.altScores.resize(RankedCrew::altLevels);
				++rCrew.altScores[altLevel];
				
				bool hasAltSkills = false;
				for (auto skillPair : rCrew.altVoySkills) {
					if (skillPair.first == primarySkill && skillPair.second == secondarySkill) {
						hasAltSkills = true;
						break;
					}
				}
				if (!hasAltSkills) {
					rCrew.altVoySkills.push_back(std::make_pair(primarySkill, secondarySkill));
				}
			}
		}
	}

	// add in immortalized crew
	VoyageCalculator calculator(jsonInput);
	for (const Crew &crew : calculator.GetRoster()) {
		if (crew.ff100 && !crew.frozen) {
			RankedCrew &rCrew = rankedCrew[crew.id];
			rCrew.crew = crew;
		}
	}

	std::vector<RankedCrew> sortedCrew;
	for (auto rankedPair : rankedCrew) {
		sortedCrew.push_back(rankedPair.second);
	}
	std::sort(sortedCrew.begin(), sortedCrew.end(), [](const auto &left, const auto &right) {
		if (left.score != right.score)
			return left.score > right.score;
		if (left.altScores.size() != right.altScores.size())
			return left.altScores.size() > right.altScores.size();
		if (left.altScores.size()) {
			for (size_t iAlt = 0; iAlt < RankedCrew::altLevels; ++iAlt) {
				if (left.altScores[iAlt] != right.altScores[iAlt])
					return left.altScores[iAlt] > right.altScores[iAlt];
			}
		}
		if (left.crew.max_rarity != right.crew.max_rarity)
			return left.crew.max_rarity > right.crew.max_rarity;
		return left.crew.name < right.crew.name;
	});

	return sortedCrew;
}

} // namespace VoyageTools