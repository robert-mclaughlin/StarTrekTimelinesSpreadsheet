#include <emscripten/emscripten.h>
#include <emscripten/bind.h>

#include "VoyageCalculator.h"

// TO BUILD:
// em++ ..\native\VoyageCalculator.cpp main.cpp -o out\voymod.js --bind -O3 -std=c++1y -s DISABLE_EXCEPTION_CATCHING=0 -s NO_EXIT_RUNTIME=1 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME="VoyMod" -I "." -I "..\native"

std::string calculate(std::string input, emscripten::val callback) {
	std::unique_ptr<VoyageTools::VoyageCalculator> voyageCalculator = std::unique_ptr<VoyageTools::VoyageCalculator>(new VoyageTools::VoyageCalculator(input.c_str()));

	auto ResultToString = [&](const std::array<const VoyageTools::Crew *, VoyageTools::SLOT_COUNT> &res, double score) noexcept
	{
		nlohmann::json j;
		j["score"] = score;
		j["selection"] = nlohmann::json::array();
		for (int i = 0; i < VoyageTools::SLOT_COUNT; i++)
		{
			j["selection"].push_back(nlohmann::json::object({ {"slotId", voyageCalculator->GetSlotId(i)}, {"crewId", res[i]->id} }));
		}

		return j.dump();
	};

	double finalScore;
	auto finalResult = voyageCalculator->Calculate([&](const std::array<const VoyageTools::Crew *, VoyageTools::SLOT_COUNT> &bestSoFar, double bestScore) {
		auto resultSoFar = ResultToString(bestSoFar, bestScore);
		callback(resultSoFar);
	}, finalScore);

	return ResultToString(finalResult, finalScore);
}

EMSCRIPTEN_BINDINGS(my_module) {
    emscripten::function("calculate", &calculate);
}
