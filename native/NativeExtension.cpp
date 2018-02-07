#include "NativeExtension.h"
#include "VoyageCalculator.h"

using v8::FunctionTemplate;

class VoyageWorker : public Nan::AsyncProgressWorker
{
public:
  VoyageWorker(Nan::Callback *callback, Nan::Callback *progressCallback, const char *input)
      : Nan::AsyncProgressWorker(callback), progressCallback(progressCallback)
  {
    voyageCalculator = std::make_unique<VoyageTools::VoyageCalculator>(input);
  }

  void Execute(const Nan::AsyncProgressWorker::ExecutionProgress &progress) override
  {
    double finalScore;
    auto finalResult = voyageCalculator->Calculate([&](const std::array<const VoyageTools::Crew*, VoyageTools::SLOT_COUNT>& bestSoFar, double bestScore) {
      auto resultSoFar = ResultToString(bestSoFar, bestScore);
      progress.Send(resultSoFar.c_str(), resultSoFar.size());
    }, finalScore);

    result = ResultToString(finalResult, finalScore);
  }

  void HandleOKCallback() override
  {
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {Nan::New(result.c_str(), result.size()).ToLocalChecked()};
    callback->Call(1, argv);
  };

  void HandleProgressCallback(const char *data, size_t size)
  {
    Nan::HandleScope scope;
    v8::Local<v8::Value> argv[] = {Nan::New(data, size).ToLocalChecked()};
    progressCallback->Call(1, argv);
  }

private:
  std::string ResultToString(const std::array<const VoyageTools::Crew*, VoyageTools::SLOT_COUNT>& res, double score) noexcept
  {
    nlohmann::json j;
    for(int i = 0; i < VoyageTools::SLOT_COUNT; i++)
    {
      j["selection"][voyageCalculator->GetSlotName(i)] = res[i]->id;
    }
    j["score"] = score;
    return j.dump();
  }

  Nan::Callback *progressCallback;
  std::string result;
  std::unique_ptr<VoyageTools::VoyageCalculator> voyageCalculator;
};

NAN_METHOD(calculateVoyageRecommendations)
{
  //std::cout << std::thread::hardware_concurrency() << " concurrent threads are supported.\n";

  if (info.Length() != 3)
  {
    Nan::ThrowTypeError("Wrong number of arguments; 3 expected");
    return;
  }

  if (!info[0]->IsString())
  {
    Nan::ThrowTypeError("Wrong argument (string expected)");
    return;
  }

  if (!info[1]->IsFunction())
  {
    Nan::ThrowTypeError("Wrong argument (callback expected)");
    return;
  }

  if (!info[2]->IsFunction())
  {
    Nan::ThrowTypeError("Wrong argument (callback expected)");
    return;
  }

  v8::Local<v8::Function> callbackHandle = info[1].As<v8::Function>();
  v8::Local<v8::Function> progressCallbackHandle = info[2].As<v8::Function>();

  Nan::AsyncQueueWorker(new VoyageWorker(new Nan::Callback(callbackHandle), new Nan::Callback(progressCallbackHandle),
                                         *v8::String::Utf8Value(info[0]->ToString())));

  //return undefined
}

NAN_MODULE_INIT(InitAll)
{
  Nan::Set(target, Nan::New("calculateVoyageRecommendations").ToLocalChecked(),
           Nan::GetFunction(Nan::New<FunctionTemplate>(calculateVoyageRecommendations)).ToLocalChecked());
}

NODE_MODULE(NativeExtension, InitAll)
