#ifndef THREAD_POOL_H
#define THREAD_POOL_H

#include <thread>
#include <list>
#include <vector>
#include <functional>
#include <mutex>

namespace VoyageTools
{

// a very simple "thread pool"
// tasks can be added to be run on a new thread
// if the current thread count is at the limit, tasks will be queued and taken up
//	by next available thread.
// threads will exit if no more tasks are available
class ThreadPool
{
public:
    ThreadPool(size_t size = 0);
	~ThreadPool() { joinAll(); }

	using task = std::function<void()>;
	void add(task f);

    void joinAll();

private:
	size_t maxThreads;
	std::mutex lock;
	using lockScope = std::lock_guard<std::mutex>;
    std::list<std::thread> threads;
	std::vector<task> tasks;
};

} //namespace VoyageTools

#endif