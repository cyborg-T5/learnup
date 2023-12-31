import CourseModel from "../models/CourseModel.js"
import { catchAsyncError } from "../middlewares/catchAsyncError.js"
import errorHandlerClass from "../utils/errorClass.js";
import getDataUri from "../utils/dataUri.js";
import cloudinary from "cloudinary"
import Stats from "../models/Stats.js";

export const getAllCourses = catchAsyncError(async (req, res, next) => {
    //will not be executed unitl it find the courses
    //find is a mongoose method.
    //to find all courses from the database using the Course.find() method. It then removes the lectures field from the returned documents using the .select() method and passing the field name as a string with a minus ("-") sign in front of it.

    const keyword = req.query.keyword || "";
    const category = req.query.category || "";

    const courses = await CourseModel.find({
        title: {

            $regex: keyword,
            $options: "i",
        },
        category: {
            $regex: category,
            $options: "i",
        },
    }).select("-lectures");
    res.status(200).json({
        success: true,
        courses,
    })
})


export const createcourse  = catchAsyncError(async (req, res, next) => {
    const { title, description, category, createdBy } = req.body;
    // console.log(title, description, category, createdBy)

    if (!title || !description || !category || !createdBy) {
        return next(new errorHandlerClass("Please add all fields", 400));
    }

    const file = req.file;
    // console.log(file)

    const fileUri = getDataUri(file);
    // console.log(fileUri.content)

    const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);

    await CourseModel.create({
        title,
        description,
        category,
        createdBy,
        poster: {
            public_id: mycloud.public_id,
            url: mycloud.secure_url,
        },
    });
    res.status(200).json({
        success: true,
        message: "Coursee created succesffuly. You can add lectures now",
    })
})

export const getCourseLecture = catchAsyncError(async (req, res, next) => {
    const course = await CourseModel.findById(req.params.id);
    if (!course) {
        return next(new errorHandlerClass("Course not found", 404))
    }
    course.views += 1;
    await course.save();
    res.status(200).json({
        success: true,
        lectures: course.lectures,
    })
})


//Max video size 100MB
export const addLecture = catchAsyncError(async (req, res, next) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const course = await CourseModel.findById(id);

    if (!course) {
        return next(new errorHandlerClass("Course not found", 404))
    }

    const file = req.file;
    if (!file) {
        return next(new errorHandlerClass("File not found", 400));
    }

    const fileUri = getDataUri(file);

    const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
        resource_type: "video",
    });

    course.lectures.push({
        title,
        description,
        video: {
            public_id: mycloud.public_id,
            url: mycloud.secure_url,
        }
    })

    course.numOfVideos = course.lectures.length;
    await course.save();

    res.status(200).json({
        success: true,
        lectures: "lecture added in course",
    });
});

export const deleteCourse = catchAsyncError(async (req, res, next) => {
    const { id } = req.params;

    const course = await CourseModel.findById(id);

    if (!course) {
        return next(new errorHandlerClass("Course Not Found", 404));
    }

    await cloudinary.v2.uploader.destroy(course.poster.public_id);

    for (let i = 0; i < course.lectures.length; i++) {
        const singleLecture = course.lectures[i];
        await cloudinary.v2.uploader.destroy(singleLecture.video.public_id, {
            resource_type: "video",
        });
    }

    await course.deleteOne();

    res.status(200).json({
        success: true,
        message: "Course Deleted Successfully",
    });
});


export const deleteLecutre = catchAsyncError(async (req, res, next) => {
    const { courseId, lectureId } = req.query;

    const course = await CourseModel.findById(courseId);

    if (!course) {
        return next(new errorHandlerClass("Course Not Found", 404));
    }

    const lecture = course.lectures.find((item) => {
        if (item._id.toString() === lectureId.toString()) {
            return item;
        }
    })

    await cloudinary.v2.uploader.destroy(lecture.video.public_id, {
        resource_type: "video",
    })

    course.lectures = course.lectures.filter((item) => {
        if (item.id.toString() !== lectureId.toString()) {
            return item;
        }
    })

    course.numOfVideos = course.lectures.length;
    await CourseModel.save();

    res.status(200).json({
        success: true,
        message: "Course Deleted Successfully",
    });
});

    CourseModel.watch().on("change", async () => {
        const stats = await Stats.find({}).sort({ createdAt: "desc" }).limit(1);

        const courses = await CourseModel.find({});

        let totalViews = 0;

        for (let i = 0; i < courses.length; i++) {
            totalViews += courses[i].views;
        }
        stats[0].views = totalViews;
        stats[0].createdAt = new Date(Date.now());

        await stats[0].save();
    });



